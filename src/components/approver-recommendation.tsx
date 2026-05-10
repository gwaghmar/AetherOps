import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  approvalRoutingRule,
  request as requestTable,
  requestType,
  user,
} from "@/db/schema";

/**
 * Server component: suggests an approver based on who has most frequently
 * approved requests of the same type in this org.
 */
export async function ApproverRecommendation({
  requestId,
  organizationId,
  requestTypeId,
}: {
  requestId: string;
  organizationId: string;
  requestTypeId: string;
}) {
  // Find the top approver by approved decisions for this request type
  const rows = await db
    .select({
      approverId: approval.approverId,
      approverName: user.name,
      approverEmail: user.email,
      approved: count(approval.id),
    })
    .from(approval)
    .innerJoin(requestTable, eq(approval.requestId, requestTable.id))
    .innerJoin(user, eq(approval.approverId, user.id))
    .where(
      and(
        eq(requestTable.organizationId, organizationId),
        eq(requestTable.requestTypeId, requestTypeId),
        eq(approval.decision, "approved"),
      ),
    )
    .groupBy(approval.approverId, user.name, user.email)
    .orderBy(desc(count(approval.id)))
    .limit(3);

  if (rows.length === 0) return null;

  // Also get configured routing rules for context
  const [rule] = await db
    .select({ approverId: approvalRoutingRule.approverUserId })
    .from(approvalRoutingRule)
    .where(
      and(
        eq(approvalRoutingRule.organizationId, organizationId),
        eq(approvalRoutingRule.requestTypeId, requestTypeId),
      ),
    )
    .limit(1);

  const configuredApproverId = rule?.approverId ?? null;

  return (
    <section className="rounded-lg border p-4 text-sm" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
      <h2 className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
        ✦ AI approver insight
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
        Based on approval history for this request type:
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.approverId}
            className="flex items-center justify-between gap-2"
          >
            <span className="font-medium">
              {r.approverName ?? r.approverEmail ?? r.approverId?.slice(0, 8)}
              {r.approverId === configuredApproverId && (
                <span className="ml-1.5 rounded px-1 py-0.5 text-xs" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                  configured
                </span>
              )}
            </span>
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>
              {r.approved} approval{Number(r.approved) !== 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
