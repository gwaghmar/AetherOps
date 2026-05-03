import { randomUUID } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, requestType, user } from "@/db/schema";
import { recordAuditEvent } from "@/server/audit";
import { resolveApproverUserIds } from "@/server/approval-routing";
import { evaluatePolicyOrThrow } from "@/server/policy-engine";
import { triageRequestAsync } from "@/server/ai/triage";
import { deliverOrgWebhook } from "@/server/webhooks";
import { getPublicAppUrl } from "@/lib/env";
import { sendRequestCreatedNotifications } from "@/server/notifications/request-created";
import { enqueueFulfillmentJob, processFulfillmentJobById } from "@/server/fulfillment-queue";
import { approval } from "@/db/schema";

/** Insert a request after payload is validated against the request type schema. */
export async function createRequestCore(input: {
  organizationId: string;
  requesterId: string;
  requestTypeId: string;
  payload: Record<string, unknown>;
  typeSlug: string;
  typeTitle: string;
  typeRiskDefaults: unknown;
  auditAction: string;
  auditActorId: string | null;
  auditMetadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
  expiresAt?: Date | null;
  isEmergencyOverride?: boolean;
  overrideReason?: string;
}) {
  await evaluatePolicyOrThrow({
    organizationId: input.organizationId,
    requestTypeSlug: input.typeSlug,
    payload: input.payload,
  });

  const approverIds = await resolveApproverUserIds({
    organizationId: input.organizationId,
    requestTypeId: input.requestTypeId,
  });
  const primaryApproverId = approverIds[0] ?? null;
  const routingSnapshot =
    approverIds.length > 0 ? approverIds : null;

  const id = randomUUID();
  const insertValues = {
    id,
    organizationId: input.organizationId,
    requestTypeId: input.requestTypeId,
    requesterId: input.requesterId,
    assignedApproverId: primaryApproverId,
    status: input.isEmergencyOverride ? "approved" : "pending_approval",
    payload: input.payload,
    routingApproverIds: routingSnapshot,
    idempotencyKey: input.idempotencyKey ?? null,
    expiresAt: input.expiresAt ?? null,
    isEmergencyOverride: input.isEmergencyOverride ?? false,
    overrideReason: input.overrideReason ?? null,
  };

  let jobId: string | null = null;
  try {
    if (input.isEmergencyOverride) {
      await db.transaction(async (tx) => {
        await tx.insert(requestTable).values(insertValues);
        await tx.insert(approval).values({
          id: randomUUID(),
          requestId: id,
          approverId: input.requesterId, // Self-approved break-glass
          decision: "emergency_approved",
          comment: input.overrideReason,
        });
        jobId = await enqueueFulfillmentJob({ organizationId: input.organizationId, requestId: id, actorId: input.requesterId }, tx);
      });
    } else {
      await db.insert(requestTable).values(insertValues);
    }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505" &&
      input.idempotencyKey
    ) {
      // Unique constraint violation (RLY-01)
      const [existing] = await db
        .select({ id: requestTable.id })
        .from(requestTable)
        .where(
          and(
            eq(requestTable.organizationId, input.organizationId),
            eq(requestTable.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);
      
      if (existing) {
        return { id: existing.id };
      }
    }
    throw err;
  }

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorId: input.auditActorId,
    entityType: "request",
    entityId: id,
    action: input.auditAction,
    metadata: {
      requestTypeSlug: input.typeSlug,
      ...input.auditMetadata,
    },
  });

  const [requester] = await db
    .select({
      email: user.email,
      name: user.name,
      department: user.department,
      managerUserId: user.managerUserId,
    })
    .from(user)
    .where(eq(user.id, input.requesterId))
    .limit(1);

  const reviewUrl = `${getPublicAppUrl().replace(/\/$/, "")}/requests/${id}`;

  if (input.isEmergencyOverride) {
    void deliverOrgWebhook({
      organizationId: input.organizationId,
      event: "request.emergency_approved",
      data: { requestId: id, adminUserId: input.requesterId, reason: input.overrideReason },
    });
    
    await recordAuditEvent({
      organizationId: input.organizationId,
      actorId: input.requesterId,
      entityType: "request",
      entityId: id,
      action: "emergency_override_approved",
      metadata: { reason: input.overrideReason },
    });
    
    if (jobId) {
      void processFulfillmentJobById(jobId);
    }
  } else {
    void deliverOrgWebhook({
      organizationId: input.organizationId,
      event: "request.submitted",
      data: {
        requestId: id,
        requestTypeSlug: input.typeSlug,
        requesterId: input.requesterId,
        requesterEmail: requester?.email ?? null,
        assignedApproverId: primaryApproverId,
        routingApproverIds: routingSnapshot,
        reviewUrl,
      },
    });

    void sendRequestCreatedNotifications({
      requestId: id,
      organizationId: input.organizationId,
      requestTypeSlug: input.typeSlug,
      requesterId: input.requesterId,
      requesterEmail: requester?.email ?? "",
      requesterName: requester?.name ?? "",
      requesterDepartment: requester?.department ?? null,
      requesterManagerUserId: requester?.managerUserId ?? null,
      approverUserIds: approverIds,
      reviewUrl,
    });
  }

  void triageRequestAsync({
    requestId: id,
    organizationId: input.organizationId,
    requestTypeTitle: input.typeTitle,
    requestTypeSlug: input.typeSlug,
    riskDefaults: input.typeRiskDefaults,
    payload: input.payload,
  });

  return { id };
}

export async function findRequestTypeBySlug(
  organizationId: string,
  slug: string,
) {
  const [type] = await db
    .select()
    .from(requestType)
    .where(
      and(
        eq(requestType.organizationId, organizationId),
        eq(requestType.slug, slug),
        isNull(requestType.archivedAt),
      ),
    )
    .limit(1);
  return type ?? null;
}

export async function findUserByEmailInOrg(
  organizationId: string,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const [u] = await db
    .select()
    .from(user)
    .where(
      and(
        eq(user.organizationId, organizationId),
        sql`lower(${user.email}) = ${normalized}`,
      ),
    )
    .limit(1);
  return u ?? null;
}
