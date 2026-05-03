import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalRoutingRule,
  user,
} from "@/db/schema";

/**
 * Ordered distinct approver user ids for a new request.
 * 1) Rules for this request type (sort_order asc, then created order).
 * 2) Org-wide fallback rules (request_type_id is null).
 * 3) Legacy: any user with role approver in org (email asc) if no rules.
 */
export async function resolveApproverUserIds(input: {
  organizationId: string;
  requestTypeId: string;
}): Promise<string[]> {
  const { organizationId, requestTypeId } = input;

  const typeRules = await db
    .select({ approverUserId: approvalRoutingRule.approverUserId })
    .from(approvalRoutingRule)
    .where(
      and(
        eq(approvalRoutingRule.organizationId, organizationId),
        eq(approvalRoutingRule.requestTypeId, requestTypeId),
      ),
    )
    .orderBy(asc(approvalRoutingRule.sortOrder), asc(approvalRoutingRule.createdAt));

  const fallbackRules = await db
    .select({ approverUserId: approvalRoutingRule.approverUserId })
    .from(approvalRoutingRule)
    .where(
      and(
        eq(approvalRoutingRule.organizationId, organizationId),
        isNull(approvalRoutingRule.requestTypeId),
      ),
    )
    .orderBy(asc(approvalRoutingRule.sortOrder), asc(approvalRoutingRule.createdAt));

  const ordered = [...typeRules, ...fallbackRules].map((r) => r.approverUserId);
  const distinct: string[] = [];
  const seen = new Set<string>();
  for (const id of ordered) {
    if (!seen.has(id)) {
      seen.add(id);
      distinct.push(id);
    }
  }
  if (distinct.length > 0) return distinct;

  const approvers = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(eq(user.organizationId, organizationId), eq(user.role, "approver")),
    )
    .orderBy(asc(user.email));

  return approvers.map((a) => a.id);
}

/** True if the user may approve this request (non-admin path). */
export function isApproverAllowedForRequest(input: {
  approverUserId: string;
  routingApproverIds: string[] | null | undefined;
  assignedApproverId: string | null;
}): boolean {
  const { approverUserId, routingApproverIds, assignedApproverId } = input;
  if (routingApproverIds != null && routingApproverIds.length > 0) {
    return routingApproverIds.includes(approverUserId);
  }
  if (assignedApproverId) {
    return assignedApproverId === approverUserId;
  }
  // Fail-closed: when no routing or assignment data exists, deny rather than
  // allowing any org approver to approve. Admins bypass this check separately.
  return false;
}
