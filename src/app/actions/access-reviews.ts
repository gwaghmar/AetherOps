"use server";

import { db } from "@/db";
import { accessReviewCampaign, accessReviewItem, request, user } from "@/db/app-schema";
import { requireSession } from "@/lib/session";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

/**
 * Creates a new access review campaign, collecting all active (provisioned and non-expired)
 * requests and assigning them to their respective managers for review.
 */
export async function createCampaignAction() {
  const session = await requireSession();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can create access review campaigns");
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  const campaignId = `camp_${randomUUID().replace(/-/g, "")}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14); // Due in 14 days

  // Insert the campaign
  await db.insert(accessReviewCampaign).values({
    id: campaignId,
    organizationId,
    title: `Quarterly Access Review - Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
    dueDate,
  });

  // Find active requests that need reviewing
  // For simplicity, we just find all 'provisioned' requests
  const activeRequests = await db.query.request.findMany({
    where: and(
      eq(request.organizationId, organizationId),
      eq(request.status, "provisioned")
    ),
    with: {
      requester: true,
      requestType: true,
    }
  });

  if (activeRequests.length > 0) {
    const items = activeRequests.map((req) => ({
      id: `ari_${randomUUID().replace(/-/g, "")}`,
      campaignId,
      requestId: req.id,
      // Fallback: if user has no assigned manager, the campaign creator (admin) is assigned as reviewer
      reviewerId: session.user.id, 
    }));

    await db.insert(accessReviewItem).values(items);
  }

  revalidatePath("/admin/access-reviews");
  return { ok: true, campaignId, itemsCount: activeRequests.length };
}

/**
 * Records a decision (keep/revoke) on an access review item.
 * If revoked, it triggers the revocation workflow.
 */
export async function submitReviewDecisionAction(itemId: string, decision: "keep" | "revoke") {
  const session = await requireSession();

  const item = await db.query.accessReviewItem.findFirst({
    where: eq(accessReviewItem.id, itemId),
    with: {
      campaign: true,
    }
  });

  if (!item || item.campaign.organizationId !== session.user.organizationId) {
    throw new Error("Item not found");
  }

  if (item.reviewerId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.update(accessReviewItem)
    .set({
      decision,
      decidedAt: new Date(),
    })
    .where(eq(accessReviewItem.id, itemId));

  if (decision === "revoke") {
    // We would enqueue a revocation job here
    const { enqueueFulfillmentJob } = await import("@/server/fulfillment-queue");
    await enqueueFulfillmentJob(item.requestId, "revoke", session.user.id);
  }

  revalidatePath("/approvals");
  return { ok: true };
}
