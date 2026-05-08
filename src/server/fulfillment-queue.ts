import { randomUUID } from "crypto";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { fulfillmentJob, request as requestTable } from "@/db/schema";
import { recordAuditEvent } from "@/server/audit";
import { runJobWithConnector } from "@/server/fulfillment";
import { deliverOrgWebhook } from "@/server/webhooks";

const OPEN_STATUSES = ["pending", "processing"] as const;
const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

type DbExecutor = { insert: typeof db.insert; select: typeof db.select };

/**
 * Enqueue a fulfillment job. Accepts an optional transaction executor so the
 * insert can be made atomic with the approval status update — if the server
 * crashes after the TX commits, the job row is guaranteed to exist.
 */
export async function enqueueFulfillmentJob(
  input: {
    organizationId: string;
    requestId: string;
    actorId: string | null;
    jobType?: "provision" | "revoke";
  },
  executor: DbExecutor = db,
): Promise<string> {
  const jobType = input.jobType ?? "provision";
  const [open] = await executor
    .select({ id: fulfillmentJob.id })
    .from(fulfillmentJob)
    .where(
      and(
        eq(fulfillmentJob.requestId, input.requestId),
        eq(fulfillmentJob.jobType, jobType),
        inArray(fulfillmentJob.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);

  if (open) return open.id;

  const id = randomUUID();
  await executor.insert(fulfillmentJob).values({
    id,
    organizationId: input.organizationId,
    requestId: input.requestId,
    actorId: input.actorId,
    jobType,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
  });
  return id;
}

export async function processFulfillmentJobById(jobId: string): Promise<void> {
  const [job] = await db
    .select()
    .from(fulfillmentJob)
    .where(eq(fulfillmentJob.id, jobId))
    .limit(1);

  if (!job) return;

  const staleCutoff = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);
  const canRetryFailed = job.status === "failed" && job.attempts < job.maxAttempts;
  const isStaleProcessing =
    job.status === "processing" &&
    job.attempts < job.maxAttempts &&
    job.updatedAt <= staleCutoff;

  if (job.status !== "pending" && !canRetryFailed && !isStaleProcessing) return;

  const nextAttempts = job.attempts + 1;

  const claimed = await db
    .update(fulfillmentJob)
    .set({
      status: "processing",
      attempts: nextAttempts,
      updatedAt: new Date(),
    })
    .where(and(eq(fulfillmentJob.id, jobId), eq(fulfillmentJob.status, job.status)))
    .returning();

  if (claimed.length === 0) return;

  await executeProvisioning(claimed[0]);
}

/** The actual provisioning/revocation and terminal-state updates for a claimed job */
async function executeProvisioning(job: typeof fulfillmentJob.$inferSelect): Promise<void> {
  const type = (job.jobType as "provision" | "revoke") || "provision";
  try {
    const { runJobWithConnector } = await import("@/server/fulfillment");
    await runJobWithConnector({
      requestId: job.requestId,
      organizationId: job.organizationId,
      actorId: job.actorId,
    }, type);

    await db
      .update(fulfillmentJob)
      .set({ status: "succeeded", updatedAt: new Date(), lastError: null })
      .where(eq(fulfillmentJob.id, job.id));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown fulfillment error";

    const exhausted = job.attempts >= job.maxAttempts;
    const nextStatus = exhausted ? "failed" : "pending";

    if (exhausted) {
      if (type === "provision") {
        await db
          .update(requestTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(requestTable.id, job.requestId));
      } else {
        // Revoke exhausted all attempts — surface as revocation_failed so it doesn't stay stuck in revocation_pending
        await db
          .update(requestTable)
          .set({ status: "revocation_failed", updatedAt: new Date() })
          .where(eq(requestTable.id, job.requestId));
      }

      await recordAuditEvent({
        organizationId: job.organizationId,
        actorId: null,
        entityType: "request",
        entityId: job.requestId,
        action: type === "provision" ? "provision_failed" : "revocation_failed",
        metadata: { error: message.slice(0, 500) },
      });

      void deliverOrgWebhook({
        organizationId: job.organizationId,
        event: type === "provision" ? "provision.failed" : "provision.revocation_failed",
        data: { requestId: job.requestId, error: message.slice(0, 500) },
      });
    }


    await db
      .update(fulfillmentJob)
      .set({
        status: nextStatus,
        lastError: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(fulfillmentJob.id, job.id));

    if (exhausted) {
      throw err;
    }
  }
}

/** Drain pending jobs (cron / worker). Uses database locking for safe concurrent fetching. */
export async function processStaleFulfillmentJobs(limit: number): Promise<{
  processed: number;
  errors: number;
}> {
  const staleCutoff = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);

  // RLY-04: distributed locks guarantee concurrent workers don't steal same subsets
  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: fulfillmentJob.id })
      .from(fulfillmentJob)
      .where(
        or(
          inArray(fulfillmentJob.status, ["pending", "failed"]),
          and(eq(fulfillmentJob.status, "processing"), lte(fulfillmentJob.updatedAt, staleCutoff))
        )
      )
      .orderBy(asc(fulfillmentJob.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];

    const ids = candidates.map(c => c.id);

    return tx.update(fulfillmentJob)
      .set({
        status: "processing",
        attempts: sql`${fulfillmentJob.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(inArray(fulfillmentJob.id, ids))
      .returning();
  });

  let errors = 0;
  let processed = 0;
  
  for (const job of claimed) {
    try {
      await executeProvisioning(job);
      processed++;
    } catch {
      errors++;
    }
  }
  
  return { processed, errors };
}
