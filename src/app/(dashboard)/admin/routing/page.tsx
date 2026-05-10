import { and, asc, eq, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  approvalRoutingRule,
  requestType,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { RoutingAdminClient } from "./routing-client";

export default async function AdminRoutingPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    redirect("/");
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;
  }

  const types = await db
    .select({
      id: requestType.id,
      title: requestType.title,
      slug: requestType.slug,
    })
    .from(requestType)
    .where(
      and(
        eq(requestType.organizationId, orgId),
        isNull(requestType.archivedAt),
      ),
    )
    .orderBy(asc(requestType.title));

  const approvers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      and(
        eq(user.organizationId, orgId),
        or(eq(user.role, "approver"), eq(user.role, "admin")),
      ),
    )
    .orderBy(asc(user.email));

  const rules = await db
    .select({
      id: approvalRoutingRule.id,
      sortOrder: approvalRoutingRule.sortOrder,
      requestTypeId: approvalRoutingRule.requestTypeId,
      typeTitle: requestType.title,
      approverEmail: user.email,
    })
    .from(approvalRoutingRule)
    .innerJoin(user, eq(approvalRoutingRule.approverUserId, user.id))
    .leftJoin(
      requestType,
      eq(approvalRoutingRule.requestTypeId, requestType.id),
    )
    .where(eq(approvalRoutingRule.organizationId, orgId))
    .orderBy(
      asc(approvalRoutingRule.requestTypeId),
      asc(approvalRoutingRule.sortOrder),
      asc(approvalRoutingRule.createdAt),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Approval routing
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Map catalog types (or the whole org) to approvers. Lower sort order
          comes first in the pool.
        </p>
      </div>
      <RoutingAdminClient types={types} approvers={approvers} rules={rules} />
    </div>
  );
}
