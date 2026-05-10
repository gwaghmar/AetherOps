import Link from "next/link";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  request as requestTable,
  requestType,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requestStatusLabel } from "@/lib/status-labels";

const PAGE_SIZE = 25;

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "approver" && role !== "admin") {
    redirect("/");
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;
  }

  const { before } = await searchParams;
  const cursor = before ? new Date(before) : null;

  const statusClause = or(
    eq(requestTable.status, "pending_approval"),
    eq(requestTable.status, "needs_info"),
  );

  const uid = session.user.id;
  const inRoutingPool = sql`coalesce(${requestTable.routingApproverIds}, '[]'::jsonb) @> ${JSON.stringify([uid])}::jsonb`;

  const approverClause =
    role === "admin"
      ? undefined
      : or(
          eq(requestTable.assignedApproverId, uid),
          isNull(requestTable.assignedApproverId),
          inRoutingPool,
        );

  const cursorClause = cursor ? lt(requestTable.createdAt, cursor) : undefined;

  const conditions = [
    eq(requestTable.organizationId, orgId),
    statusClause,
    approverClause,
    cursorClause,
  ].filter(Boolean);

  const whereExpr = and(...(conditions as Parameters<typeof and>));

  const rows = await db
    .select({
      id: requestTable.id,
      status: requestTable.status,
      payload: requestTable.payload,
      createdAt: requestTable.createdAt,
      typeTitle: requestType.title,
      requesterEmail: user.email,
    })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .innerJoin(user, eq(requestTable.requesterId, user.id))
    .where(whereExpr)
    .orderBy(desc(requestTable.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1]?.createdAt?.toISOString()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Summary-first cards; open a request to decide.
          {cursor && (
            <span className="ml-2">
              <Link href="/approvals" className="font-medium underline">
                Back to first page
              </Link>
            </span>
          )}
        </p>
      </div>
      <ul className="space-y-3">
        {pageRows.length === 0 ? (
          <li
            className="rounded-lg border border-dashed px-4 py-8 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            <p>No pending items.</p>
            {role === "admin" && (
              <p className="mt-2">
                If your team isn&apos;t submitting yet, finish{" "}
                <Link href="/onboarding" className="font-medium underline">
                  onboarding
                </Link>{" "}
                or review the{" "}
                <Link href="/admin/types" className="font-medium underline">
                  catalog
                </Link>
                .
              </p>
            )}
          </li>
        ) : (
          pageRows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="block rounded-lg border p-4 transition hover:opacity-90"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: "var(--subtle)" }}
                  >
                    {requestStatusLabel(r.status)}
                  </span>
                  <span className="text-sm font-medium">{r.typeTitle}</span>
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
                  Requester: {r.requesterEmail}
                </p>
                <div
                  className="mt-2.5 rounded-lg p-2.5 text-sm"
                  style={{ background: "var(--subtle)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                    Summary for approval
                  </p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(
                      r.payload as Record<string, unknown>,
                    ).map(([k, v]) => (
                      <li key={k}>
                        <span style={{ color: "var(--ink-3)" }}>{k}: </span>
                        {String(v)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
                    Policy verdicts are evaluated on the request detail flow when a
                    policy engine is configured.
                  </p>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Link
            href={`/approvals?before=${encodeURIComponent(nextCursor)}`}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-80"
            style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            Load older items
          </Link>
        </div>
      )}
    </div>
  );
}
