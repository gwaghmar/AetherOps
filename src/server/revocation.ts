import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable } from "@/db/schema";
import { enqueueFulfillmentJob } from "@/server/fulfillment-queue";
import { recordAuditEvent } from "@/server/audit";
import { sendTransactionalEmail } from "@/server/email/send-email";

const NOTIFY_BEFORE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Scan for fulfilled requests that have expired and enqueue revocation jobs.
 */
export async function scanAndEnqueueRevocations() {
  const now = new Date();

  const expired = await db
    .select()
    .from(requestTable)
    .where(
      and(
        eq(requestTable.status, "fulfilled"),
        lte(requestTable.expiresAt, now),
      ),
    );

  console.info(`[revocation] Found ${expired.length} expired requests to revoke.`);

  for (const req of expired) {
    try {
      await db.transaction(async (tx) => {
        await enqueueFulfillmentJob(
          {
            organizationId: req.organizationId,
            requestId: req.id,
            actorId: null,
            jobType: "revoke",
          },
          tx,
        );

        await tx
          .update(requestTable)
          .set({ status: "revocation_pending", updatedAt: new Date() })
          .where(eq(requestTable.id, req.id));

        await recordAuditEvent(
          {
            organizationId: req.organizationId,
            actorId: null,
            entityType: "request",
            entityId: req.id,
            action: "revocation_enqueued",
            metadata: { expiresAt: req.expiresAt },
          },
          tx,
        );
      });
    } catch (err) {
      console.error(`[revocation] Failed to enqueue revocation for ${req.id}:`, err);
    }
  }

  return { enqueued: expired.length };
}

/**
 * Scan for fulfilled requests expiring within 2 hours and send email notifications.
 */
export async function scanAndNotifyExpiring() {
  const now = new Date();
  const notifyThreshold = new Date(now.getTime() + NOTIFY_BEFORE_EXPIRY_MS);

  const expiring = await db.query.request.findMany({
    where: and(
      eq(requestTable.status, "fulfilled"),
      gte(requestTable.expiresAt, now),
      lte(requestTable.expiresAt, notifyThreshold),
      isNull(requestTable.preExpiryNotifiedAt),
    ),
    with: {
      requester: true,
      requestType: true,
    },
  });

  console.info(`[revocation] Found ${expiring.length} requests expiring soon for notification.`);

  let notified = 0;
  for (const req of expiring) {
    try {
      const expiresAt = req.expiresAt!;
      const minutesLeft = Math.round((expiresAt.getTime() - now.getTime()) / 60_000);

      await sendTransactionalEmail({
        organizationId: req.organizationId,
        to: req.requester.email,
        subject: `Access expiring in ${minutesLeft} min — ${req.requestType.title}`,
        html: `
          <div style="font-family: sans-serif; color: #111;">
            <h2>Your access is about to expire</h2>
            <p>Your access for <strong>${req.requestType.title}</strong> will be automatically revoked in approximately <strong>${minutesLeft} minutes</strong>.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Expires at:</strong> ${expiresAt.toLocaleString()}</p>
            <p><strong>Request ID:</strong> <code>${req.id}</code></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 14px; color: #666;">If you need continued access, please submit a new request before expiry.</p>
          </div>
        `,
      });

      await db
        .update(requestTable)
        .set({ preExpiryNotifiedAt: new Date() })
        .where(eq(requestTable.id, req.id));

      await recordAuditEvent({
        organizationId: req.organizationId,
        actorId: null,
        entityType: "request",
        entityId: req.id,
        action: "expiry_notification_sent",
        metadata: { expiresAt: req.expiresAt, minutesLeft },
      });

      notified++;
    } catch (err) {
      console.error(`[revocation] Failed to notify for expiring request ${req.id}:`, err);
    }
  }

  return { notified };
}
