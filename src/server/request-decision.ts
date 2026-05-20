import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { approval, request as requestTable } from "@/db/schema";
import { isApproverAllowedForRequest } from "@/server/approval-routing";
import { recordAuditEvent } from "@/server/audit";
import {
  enqueueFulfillmentJob,
  processFulfillmentJobById,
} from "@/server/fulfillment-queue";
import { deliverOrgWebhook } from "@/server/webhooks";

export type RequestDecision = "approved" | "denied" | "needs_info" | "emergency_approved";

const APPROVABLE_STATUSES = ["pending_approval", "needs_info"] as const;

/**
 * Apply an approval decision (shared by session action and email token API).
 * Does not call revalidatePath — caller must do that.
 */
export async function applyRequestDecision(input: {
  organizationId: string;
  requestId: string;
  decision: RequestDecision;
  comment?: string | null;
  actorUserId: string;
  actorRole: "approver" | "admin";
}): Promise<void> {
  const { organizationId: orgId, requestId, decision, comment, actorUserId: approverId, actorRole } = input;

  if (decision === "emergency_approved") {
    throw new Error("emergency_approved decisions must go through applyEmergencyOverride.");
  }

  const [req] = await db
    .select()
    .from(requestTable)
    .where(and(eq(requestTable.id, requestId), eq(requestTable.organizationId, orgId)))
    .limit(1);

  if (!req) throw new Error("Request not found.");

  const targetStatus =
    decision === "approved" ? "approved" : decision === "denied" ? "denied" : "needs_info";

  // Idempotency: already in target state
  if (req.status === targetStatus) return;

  if (!APPROVABLE_STATUSES.includes(req.status as (typeof APPROVABLE_STATUSES)[number])) {
    throw new Error("Request is not awaiting approval.");
  }

  if (actorRole === "approver") {
    const allowed = isApproverAllowedForRequest({
      approverUserId: approverId,
      routingApproverIds: req.routingApproverIds ?? null,
      assignedApproverId: req.assignedApproverId,
    });
    if (!allowed) throw new Error("You are not authorized to approve this request.");
  }

  // Friendly check before hitting the unique index
  const [existingDecision] = await db
    .select({ id: approval.id })
    .from(approval)
    .where(
      and(
        eq(approval.requestId, req.id),
        eq(approval.approverId, approverId),
        sql`${approval.decision} in ('approved', 'denied')`,
      ),
    )
    .limit(1);
  if (existingDecision) throw new Error("You have already decided on this request.");

  const routingApproverIds = (req.routingApproverIds as string[] | null) ?? [];
  // Falls back to 1 when routingApproverIds is empty — only reachable via the admin path
  // since isApproverAllowedForRequest blocks non-admin approvers when no routing ids exist.
  const requiredCount = routingApproverIds.length > 0 ? routingApproverIds.length : 1;
  let jobId: string | null = null;

  try {
  await db.transaction(async (tx) => {
    await tx.insert(approval).values({
      id: randomUUID(),
      requestId: req.id,
      approverId,
      decision,
      comment: comment ?? null,
    });

    if (decision === "denied") {
      await tx
        .update(requestTable)
        .set({ status: "denied", updatedAt: new Date() })
        .where(
          and(
            eq(requestTable.id, req.id),
            eq(requestTable.organizationId, orgId),
            inArray(requestTable.status, [...APPROVABLE_STATUSES]),
          ),
        );
    } else if (decision === "approved") {
      // Only count approvals from routed approvers — admin/non-routed clicks must not satisfy the quorum
      const approvalWhere =
        routingApproverIds.length > 0
          ? and(
              eq(approval.requestId, req.id),
              eq(approval.decision, "approved"),
              inArray(approval.approverId, routingApproverIds),
            )
          : and(eq(approval.requestId, req.id), eq(approval.decision, "approved"));
      const [countRow] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(approval)
        .where(approvalWhere);

      const approvedCount = Number(countRow?.count ?? 0);

      if (approvedCount >= requiredCount) {
        const updated = await tx
          .update(requestTable)
          .set({ status: "approved", updatedAt: new Date() })
          .where(
            and(
              eq(requestTable.id, req.id),
              eq(requestTable.organizationId, orgId),
              eq(requestTable.status, "pending_approval"),
            ),
          )
          .returning({ id: requestTable.id });

        if (updated.length > 0) {
          jobId = await enqueueFulfillmentJob(
            { organizationId: orgId, requestId: req.id, actorId: approverId },
            tx,
          );
        }
      }
    } else if (decision === "needs_info") {
      await tx
        .update(requestTable)
        .set({ status: "needs_info", updatedAt: new Date() })
        .where(
          and(
            eq(requestTable.id, req.id),
            eq(requestTable.organizationId, orgId),
            eq(requestTable.status, "pending_approval"),
          ),
        );
    }

    await recordAuditEvent(
      {
        organizationId: orgId,
        actorId: approverId,
        entityType: "request",
        entityId: req.id,
        action: `approval_${decision}`,
        metadata: { comment: comment ?? undefined },
      },
      tx,
    );
  });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      throw new Error("You have already decided on this request.");
    }
    throw err;
  }

  if (decision !== "approved" || !jobId) return;

  void deliverOrgWebhook({
    organizationId: orgId,
    event: "request.approved",
    data: { requestId: req.id, approverId },
  });

  await processFulfillmentJobById(jobId);
}

/**
 * Superuser action to force bypass approval constraints with mandatory audit reason.
 */
export async function applyEmergencyOverride(input: {
  organizationId: string;
  requestId: string;
  adminUserId: string;
  reason: string;
  durationDays?: number;
}): Promise<void> {
  const { organizationId: orgId, requestId, adminUserId, reason, durationDays } = input;

  const [req] = await db
    .select()
    .from(requestTable)
    .where(
      and(
        eq(requestTable.id, requestId),
        eq(requestTable.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!req) throw new Error("Request not found.");
  
  // RLY-01: Idempotent return if already overridden
  if (req.isEmergencyOverride && req.status === "approved") {
    return;
  }

  if (req.status !== "pending_approval" && req.status !== "needs_info") {
    throw new Error("Request cannot be overridden from its current state.");
  }

  let jobId: string | null = null;
  const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(requestTable)
      .set({
        status: "approved",
        updatedAt: new Date(),
        isEmergencyOverride: true,
        overrideReason: reason,
        expiresAt: expiresAt,
      })
      .where(
        and(
          eq(requestTable.id, req.id),
          eq(requestTable.organizationId, orgId),
        ),
      )
      .returning({ id: requestTable.id });

    if (updated.length === 0) {
      throw new Error("Request update failed in emergency override.");
    }

    await tx.insert(approval).values({
      id: randomUUID(),
      requestId: req.id,
      approverId: adminUserId,
      decision: "emergency_approved",
      comment: reason,
    });

    await recordAuditEvent(
      {
        organizationId: orgId,
        actorId: adminUserId,
        entityType: "request",
        entityId: req.id,
        action: `emergency_override_approved`,
        metadata: { reason, durationDays },
      },
      tx,
    );

    jobId = await enqueueFulfillmentJob(
      { organizationId: orgId, requestId: req.id, actorId: adminUserId },
      tx,
    );
  });

  if (!jobId) return;

  void deliverOrgWebhook({
    organizationId: orgId,
    event: "request.emergency_approved",
    data: { requestId: req.id, adminUserId, reason },
  });

  await processFulfillmentJobById(jobId);
}
