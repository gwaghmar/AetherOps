import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, user as userTable } from "@/db/schema";
import { sendTransactionalEmail } from "@/server/email/send-email";

/**
 * Scans pending_approval requests whose approval_deadline_at has passed
 * and sla_breached_at is not yet set. Sends reminder email to routing approvers
 * and escalation email to each requester's manager.
 * Sets sla_breached_at to make each scan idempotent.
 */
export async function processApprovalSlaEscalations() {
  const now = new Date();

  const breachedRequests = await db.query.request.findMany({
    where: and(
      eq(requestTable.status, "pending_approval"),
      lt(requestTable.approvalDeadlineAt, now),
      isNull(requestTable.slaBreachedAt),
    ),
    with: {
      requester: true,
      requestType: true,
    },
  });

  console.info(`[approval-sla-watcher] Found ${breachedRequests.length} requests with breached approval SLA.`);

  for (const req of breachedRequests) {
    if (!req.requestType || !req.requester) {
      console.warn(`[approval-sla-watcher] Missing relations for request ${req.id}, skipping.`);
      continue;
    }

    // Mark breached first (idempotency — prevents re-firing if email fails)
    await db
      .update(requestTable)
      .set({ slaBreachedAt: now })
      .where(and(eq(requestTable.id, req.id), isNull(requestTable.slaBreachedAt)));

    // Notify all routing approvers who have not yet decided
    const routingIds = (req.routingApproverIds as string[] | null) ?? [];
    if (routingIds.length > 0) {
      const approvers = await db
        .select({ id: userTable.id, email: userTable.email, name: userTable.name })
        .from(userTable)
        .where(eq(userTable.organizationId, req.organizationId));

      const pendingApprovers = approvers.filter((a) => routingIds.includes(a.id));

      for (const approver of pendingApprovers) {
        try {
          await sendTransactionalEmail({
            organizationId: req.organizationId,
            to: approver.email,
            subject: `Action required: Approval overdue for "${req.requestType.title}"`,
            html: `
              <div style="font-family: sans-serif; color: #111;">
                <h2 style="color: #d97706;">Approval SLA Breached</h2>
                <p>A request is waiting for your approval and has exceeded the allowed time window.</p>
                <p><strong>Request type:</strong> ${req.requestType.title}</p>
                <p><strong>Requester:</strong> ${req.requester.name} (${req.requester.email})</p>
                <p><strong>Deadline was:</strong> ${req.approvalDeadlineAt?.toLocaleString()}</p>
                <p>Please review and decide as soon as possible.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`[approval-sla-watcher] Failed to email approver ${approver.email} for request ${req.id}`, err);
        }
      }
    }

    // Escalate to requester's manager
    if (req.requester.managerUserId) {
      const [manager] = await db
        .select({ email: userTable.email, name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, req.requester.managerUserId))
        .limit(1);

      if (manager) {
        try {
          await sendTransactionalEmail({
            organizationId: req.organizationId,
            to: manager.email,
            subject: `Escalation: "${req.requestType.title}" approval is stuck`,
            html: `
              <div style="font-family: sans-serif; color: #111;">
                <h2 style="color: #e11d48;">Approval Escalation</h2>
                <p>A request from your report has exceeded its approval SLA and remains pending.</p>
                <p><strong>Requester:</strong> ${req.requester.name}</p>
                <p><strong>Request type:</strong> ${req.requestType.title}</p>
                <p><strong>Request ID:</strong> <code>${req.id}</code></p>
                <p>Please ensure the appropriate approver takes action.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`[approval-sla-watcher] Failed to escalate to manager for request ${req.id}`, err);
        }
      }
    }
  }

  return { escalated: breachedRequests.length };
}
