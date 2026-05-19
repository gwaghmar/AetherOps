"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { request as requestTable, requestType, fulfillmentJob } from "@/db/schema";
import { assertAuditExportRangeOrThrow } from "@/lib/audit-export-limit";
import {
  buildPayloadSchema,
  parseFieldSchema,
} from "@/lib/request-schemas";
import { PolicyDeniedError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { recordAuditEvent } from "@/server/audit";
import { queryAuditExportRows } from "@/server/audit-export";
import { createRequestCore } from "@/server/create-request";
import { applyRequestDecision, applyEmergencyOverride } from "@/server/request-decision";

const createRequestInputSchema = z.object({
  requestTypeId: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
  expiresAt: z.string().datetime().optional().nullable(),
  isEmergencyOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

const decideApprovalInputSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(["approved", "denied", "needs_info"]),
  comment: z.string().max(8000).optional(),
});

function sessionOrgId(session: {
  user: { organizationId?: string | null };
}) {
  const oid = session.user.organizationId;
  if (!oid) throw new Error("User is not assigned to an organization.");
  return oid;
}

function userRole(session: { user: { role?: string | null } }) {
  return session.user.role ?? "requester";
}

export async function createRequestAction(input: {
  requestTypeId: string;
  payload: Record<string, unknown>;
  expiresAt?: string | null;
  isEmergencyOverride?: boolean;
  overrideReason?: string;
}) {
  const boundary = createRequestInputSchema.safeParse(input);
  if (!boundary.success) {
    throw new Error("Invalid request data");
  }
  const { requestTypeId, payload, expiresAt } = boundary.data;

  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;


  const session = await requireSession();
  const orgId = sessionOrgId(session);
  const requesterId = session.user.id;

  const [type] = await db
    .select()
    .from(requestType)
    .where(
      and(
        eq(requestType.id, requestTypeId),
        eq(requestType.organizationId, orgId),
        isNull(requestType.archivedAt),
      ),
    )
    .limit(1);

  if (!type) throw new Error("Request type not found or archived.");

  const fieldSchema = parseFieldSchema(type.fieldSchema);
  const parsed = buildPayloadSchema(fieldSchema.fields).safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }

  let id: string;
  try {
    const res = await createRequestCore({
      organizationId: orgId,
      requesterId,
      requestTypeId: type.id,
      payload: parsed.data as Record<string, unknown>,
      expiresAt: expiresAtDate,
      isEmergencyOverride: boundary.data.isEmergencyOverride,
      overrideReason: boundary.data.overrideReason,
      typeSlug: type.slug,
      typeTitle: type.title,
      typeRiskDefaults: type.riskDefaults,
      auditAction: "request_created",
      auditActorId: requesterId,
    });
    id = res.id;
  } catch (e) {
    if (e instanceof PolicyDeniedError) {
      return {
        ok: false as const,
        policyDenied: e.reason ?? e.message,
      };
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath("/requests/new");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/approvals");
  return { ok: true as const, requestId: id };
}

const resubmitRequestSchema = z.object({
  requestId: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
});

export async function resubmitRequestAfterInfoAction(input: {
  requestId: string;
  payload: Record<string, unknown>;
}) {
  const boundary = resubmitRequestSchema.safeParse(input);
  if (!boundary.success) throw new Error("Invalid data");

  const session = await requireSession();
  const orgId = sessionOrgId(session);
  const uid = session.user.id;

  const [req] = await db
    .select()
    .from(requestTable)
    .where(
      and(eq(requestTable.id, boundary.data.requestId), eq(requestTable.organizationId, orgId)),
    )
    .limit(1);

  if (!req) throw new Error("Request not found.");
  if (req.requesterId !== uid) {
    throw new Error("Only the requester can update this request.");
  }
  if (req.status !== "needs_info") {
    throw new Error("Request is not waiting for more information.");
  }

  const [type] = await db
    .select()
    .from(requestType)
    .where(
      and(
        eq(requestType.id, req.requestTypeId),
        eq(requestType.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!type) throw new Error("Request type not found.");

  const fieldSchema = parseFieldSchema(type.fieldSchema);
  const parsed = buildPayloadSchema(fieldSchema.fields).safeParse(
    boundary.data.payload,
  );
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }

  await db
    .update(requestTable)
    .set({
      payload: parsed.data as Record<string, unknown>,
      status: "pending_approval",
      updatedAt: new Date(),
    })
    .where(eq(requestTable.id, req.id));

  await recordAuditEvent({
    organizationId: orgId,
    actorId: uid,
    entityType: "request",
    entityId: req.id,
    action: "request_resubmitted_after_info",
    metadata: {},
  });

  await recordAuditEvent({
    organizationId: orgId,
    actorId: uid,
    entityType: "request",
    entityId: req.id,
    action: "approval_invalidated_by_resubmit",
    metadata: {},
  });

  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath(`/requests/${req.id}`);
  revalidatePath("/approvals");
  return { ok: true as const };
}

export async function decideApprovalAction(input: {
  requestId: string;
  decision: "approved" | "denied" | "needs_info";
  comment?: string;
}) {
  const boundary = decideApprovalInputSchema.safeParse(input);
  if (!boundary.success) {
    throw new Error("Invalid approval data");
  }
  const { requestId, decision, comment } = boundary.data;

  const session = await requireSession();
  const role = userRole(session);
  if (role !== "approver" && role !== "admin") {
    throw new Error("Not authorized to approve.");
  }

  const orgId = sessionOrgId(session);
  const approverId = session.user.id;

  try {
    await applyRequestDecision({
      organizationId: orgId,
      requestId,
      decision,
      comment,
      actorUserId: approverId,
      actorRole: role === "admin" ? "admin" : "approver",
    });
  } catch (err) {
    revalidatePath("/");
    revalidatePath("/approvals");
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    throw err instanceof Error ? err : new Error(String(err));
  }

  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  return { ok: true as const };
}

export async function fetchAuditExportRows(input: {
  from: Date;
  to: Date;
}) {
  assertAuditExportRangeOrThrow(input.from, input.to);
  const session = await requireSession();
  if (userRole(session) !== "admin") {
    throw new Error("Admin only.");
  }
  const orgId = sessionOrgId(session);
  return queryAuditExportRows({ orgId, from: input.from, to: input.to });
}

const emergencyOverrideInputSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().min(5).max(1000),
  durationDays: z.number().int().min(1).max(365).optional(),
});

/** Server action to break-glass override a stuck request. Strict admin-only. */
export async function emergencyOverrideAction(input: {
  requestId: string;
  reason: string;
  durationDays?: number;
}) {
  const boundary = emergencyOverrideInputSchema.safeParse(input);
  if (!boundary.success) {
    throw new Error("Invalid emergency override parameters.");
  }
  const { requestId, reason, durationDays } = boundary.data;

  // TNTY-03: Strict least privilege check for admin status!
  const session = await requireSession();
  const role = userRole(session);
  if (role !== "admin") {
    throw new Error("Only an active organization admin can perform an emergency override.");
  }

  const orgId = sessionOrgId(session);
  const adminId = session.user.id;

  try {
    await applyEmergencyOverride({
      organizationId: orgId,
      requestId,
      adminUserId: adminId,
      reason,
      durationDays,
    });
  } catch (err) {
    revalidatePath("/");
    revalidatePath("/approvals");
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    throw err instanceof Error ? err : new Error(String(err));
  }

  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  return { ok: true as const };
}

export async function completeManualFulfillmentAction(
  jobId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return { ok: false, error: "Admin role required" };
  }

  const orgId = sessionOrgId(session);

  const [job] = await db
    .select()
    .from(fulfillmentJob)
    .where(
      and(
        eq(fulfillmentJob.id, jobId),
        eq(fulfillmentJob.organizationId, orgId),
        eq(fulfillmentJob.status, "manual_action_required"),
      ),
    )
    .limit(1);

  if (!job) return { ok: false, error: "Job not found or already resolved" };

  await db
    .update(fulfillmentJob)
    .set({ status: "fulfilled", updatedAt: new Date() })
    .where(eq(fulfillmentJob.id, jobId));

  await db
    .update(requestTable)
    .set({ status: "fulfilled", updatedAt: new Date() })
    .where(eq(requestTable.id, job.requestId));

  await recordAuditEvent({
    organizationId: orgId,
    actorId: session.user.id,
    entityType: "request",
    entityId: job.requestId,
    action: "manual_provision_completed",
    metadata: { jobId },
  });

  revalidatePath("/requests");
  revalidatePath(`/requests/${job.requestId}`);
  return { ok: true };
}
