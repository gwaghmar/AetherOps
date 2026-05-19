import { db } from "@/db";
import { fulfillmentJob, user as userTable } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { sendTransactionalEmail } from "@/server/email/send-email";

const SLA_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Scans for manual fulfillment tasks that have exceeded the 48-hour SLA.
 * Triggers escalations to IT Operations.
 */
export async function processSlaEscalations() {
  const cutoff = new Date(Date.now() - SLA_THRESHOLD_MS);

  // Find manual fulfillment jobs that have been sitting for too long
  const staleJobs = await db.query.fulfillmentJob.findMany({
    where: and(
      eq(fulfillmentJob.status, "manual_action_required"),
      lte(fulfillmentJob.updatedAt, cutoff)
    ),
    with: {
      request: {
        with: {
          requester: true,
          requestType: true,
        }
      }
    }
  });

  console.info(`[sla-watcher] Found ${staleJobs.length} stale manual jobs exceeding SLA.`);

  for (const job of staleJobs) {
    const req = job.request;
    if (!req) continue;
    if (!req.requestType || !req.requester) {
      console.warn(`[sla-watcher] Missing relations for request ${req.id}, skipping.`);
      continue;
    }
    if (!job.organizationId) {
      console.warn(`[sla-watcher] fulfillmentJob ${job.id} has no organizationId, skipping.`);
      continue;
    }

    const admins = await db
      .select({ email: userTable.email, name: userTable.name })
      .from(userTable)
      .where(and(eq(userTable.organizationId, job.organizationId), eq(userTable.role, "admin")));

    const toEmails = admins.map((a) => a.email);
    if (toEmails.length === 0) {
      console.warn(`[sla-watcher] No admin users found for org ${job.organizationId}, skipping escalation for ${req.id}`);
      continue;
    }

    for (const to of toEmails) {
      try {
        await sendTransactionalEmail({
          organizationId: job.organizationId,
          to,
          subject: `SLA ESCALATION: Manual Provisioning Stalled (${req.requestType.title})`,
          html: `
            <div style="font-family: sans-serif; color: #111;">
              <h2 style="color: #e11d48;">SLA Breach Detected</h2>
              <p>The following provisioning task has been waiting for manual intervention for over 48 hours:</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p><strong>App:</strong> ${req.requestType.title}</p>
              <p><strong>Requester:</strong> ${req.requester.name} (${req.requester.email})</p>
              <p><strong>Waiting since:</strong> ${job.updatedAt.toLocaleString()}</p>
              <p><strong>Request ID:</strong> <code>${req.id}</code></p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 14px; color: #666;">Please resolve this in the Admin Dashboard.</p>
            </div>
          `,
        });
        console.info(`[sla-watcher] Escalated request ${req.id} to ${to}`);
      } catch (err) {
        console.error(`[sla-watcher] Failed to send escalation for ${req.id} to ${to}`, err);
      }
    }
  }

  return { escalated: staleJobs.length };
}
