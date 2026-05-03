import { and, eq, lte, lt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable } from "@/db/schema";
import { enqueueFulfillmentJob } from "@/server/fulfillment-queue";
import { recordAuditEvent } from "@/server/audit";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const NOTIFY_BEFORE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Scan for fulfilled requests that have expired and enqueue revocation jobs.
 */
export async function scanAndEnqueueRevocations() {
  const now = new Date();
  
  // Find fulfilled requests past expiry that aren't already being revoked
  const expired = await db
    .select()
    .from(requestTable)
    .where(
      and(
        eq(requestTable.status, "fulfilled"),
        lte(requestTable.expiresAt, now),
        // Ensure we don't have an open revoke job (handled by enqueueFulfillmentJob's idempotency too)
      )
    );

  console.info(`[revocation] Found ${expired.length} expired requests to revoke.`);

  for (const req of expired) {
    try {
      await db.transaction(async (tx) => {
        // Double check status inside TX if needed, or rely on enqueuing logic
        await enqueueFulfillmentJob({
          organizationId: req.organizationId,
          requestId: req.id,
          actorId: null, // System-triggered
          jobType: "revoke",
        }, tx);

        // Optional: Update status to revocation_pending to show intent in UI
        await tx
          .update(requestTable)
          .set({ status: "revocation_pending", updatedAt: new Date() })
          .where(eq(requestTable.id, req.id));

        await recordAuditEvent({
          organizationId: req.organizationId,
          actorId: null,
          entityType: "request",
          entityId: req.id,
          action: "revocation_enqueued",
          metadata: { expiresAt: req.expiresAt },
        }, tx);
      });
    } catch (err) {
      console.error(`[revocation] Failed to enqueue revocation for ${req.id}:`, err);
    }
  }

  return { enqueued: expired.length };
}

/**
 * Scan for fulfilled requests expiring soon and send notifications.
 */
export async function scanAndNotifyExpiring() {
  const now = new Date();
  const notifyThreshold = new Date(now.getTime() + NOTIFY_BEFORE_EXPIRY_MS);

  // Find fulfilled requests expiring in the next 2 hours that haven't been notified yet
  const expiring = await db
    .select()
    .from(requestTable)
    .where(
      and(
        eq(requestTable.status, "fulfilled"),
        lte(requestTable.expiresAt, notifyThreshold),
        lt(requestTable.expiresAt, new Date(notifyThreshold.getTime() + 60000)), // Tiny buffer
        isNull(requestTable.preExpiryNotifiedAt)
      )
    );

  console.info(`[revocation] Found ${expiring.length} requests expiring soon for notification.`);

  let notified = 0;
  for (const req of expiring) {
    try {
      // In a real app, this is where we'd call an email or Slack service.
      // For this implementation, we record the event and mark as notified.
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
        metadata: { expiresAt: req.expiresAt },
      });
      
      notified++;
    } catch (err) {
      console.error(`[revocation] Failed to notify for expiring request ${req.id}:`, err);
    }
  }

  return { notified };
}
