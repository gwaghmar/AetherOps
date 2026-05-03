import { db } from "@/db";
import { fulfillmentJob } from "@/db/schema";
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

    // Notify the IT operations team (this email should be configurable per org in prod)
    try {
      await sendTransactionalEmail({
        organizationId: job.organizationId,
        to: "it-ops@example.com", 
        subject: `🚨 SLA ESCALATION: Manual Provisioning Stalled (${req.requestType.title})`,
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
            <p style="font-size: 14px; color: #666;">Please resolve this immediately in the Admin Dashboard to maintain service availability.</p>
          </div>
        `,
      });
      
      console.info(`[sla-watcher] Escalated request ${req.id} for organization ${job.organizationId}`);
    } catch (err) {
      console.error(`[sla-watcher] Failed to send escalation for ${req.id}`, err);
    }
  }

  return { escalated: staleJobs.length };
}
