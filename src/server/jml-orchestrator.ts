import { db } from "@/db";
import { roleBundle, roleBundleRequestType, request as requestTable } from "@/db/schema";
import { createRequestCore } from "@/server/create-request";
import { eq, and, inArray } from "drizzle-orm";
import { recordAuditEvent } from "@/server/audit";
import { enqueueFulfillmentJob } from "@/server/fulfillment-queue";

/**
 * Applies a Role Bundle to a user, triggering bulk provisioning requests.
 * Used for Joiners (new hires) and Movers (role changes).
 */
export async function applyRoleBundle(userId: string, roleBundleId: string, actorId: string) {
  const bundle = await db.query.roleBundle.findFirst({
    where: eq(roleBundle.id, roleBundleId),
    with: {
      requestTypes: {
        with: {
          requestType: true,
        }
      }
    }
  });

  if (!bundle) throw new Error("Role bundle not found");

  const results = [];
  for (const bundleItem of bundle.requestTypes) {
    const type = bundleItem.requestType;
    if (!type || type.archivedAt) continue;

    try {
      // Trigger the core request lifecycle for each app in the bundle
      const res = await createRequestCore({
        organizationId: bundle.organizationId,
        requesterId: userId,
        requestTypeId: type.id,
        // Merging overrides from the bundle definition
        payload: (bundleItem.payloadOverrides as Record<string, unknown>) ?? {},
        typeSlug: type.slug,
        typeTitle: type.title,
        typeRiskDefaults: type.riskDefaults,
        auditAction: "jml_role_bundle_applied",
        auditActorId: actorId,
        auditMetadata: { 
          roleBundleId, 
          roleBundleName: bundle.name,
          automationSource: "jml_orchestrator"
        },
      });
      results.push({ typeSlug: type.slug, requestId: res.id, ok: true });
    } catch (err: unknown) {
      results.push({ typeSlug: type.slug, ok: false, error: (err as Error).message });
    }
  }

  return results;
}


/**
 * Handles offboarding (Leaver) by identifying all active/pending requests 
 * and triggering revocations where supported.
 */
export async function offboardUser(userId: string, organizationId: string, actorId: string) {
  // Find all requests for this user that are currently in 'fulfilled' or 'pending_approval' state
  // and trigger a revocation if they have been fulfilled.
  const activeRequests = await db.query.request.findMany({
    where: and(
      eq(requestTable.requesterId, userId),
      eq(requestTable.organizationId, organizationId),
      inArray(requestTable.status, ["fulfilled", "pending_approval", "approved"])
    )
  });

  const results = [];
  for (const req of activeRequests) {
    if (req.status === "fulfilled") {
      try {
        await enqueueFulfillmentJob({
          organizationId,
          requestId: req.id,
          actorId,
          jobType: "revoke",
        });
        results.push({ requestId: req.id, action: "revocation_enqueued", ok: true });
      } catch (err: unknown) {
        results.push({ requestId: req.id, action: "revocation_failed", ok: false, error: (err as Error).message });
      }
    } else {
      // For pending requests, we can simply cancel/deny them
      // This part could be expanded to explicitly mark them as 'cancelled'
      results.push({ requestId: req.id, action: "pending_request_skipped", ok: true });
    }
  }

  await recordAuditEvent({
    organizationId,
    actorId,
    entityType: "user",
    entityId: userId,
    action: "user_offboarded",
    metadata: { 
      revocationsEnqueued: results.filter(r => r.action === "revocation_enqueued").length,
      skippedRequests: results.filter(r => r.action === "pending_request_skipped").length
    },
  });

  return { ok: true, results };
}
