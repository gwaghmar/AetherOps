import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  approval,
  request as requestTable,
  requestType,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import Link from "next/link";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await requireRole(["admin"]);
  const orgId = session.user.organizationId;
  if (!orgId) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Parallel queries
  const [
    statusCounts,
    topTypes,
    recentVolume,
    avgDecisionMs,
  ] = await Promise.all([
    // Requests by status
    db
      .select({ status: requestTable.status, n: count() })
      .from(requestTable)
      .where(eq(requestTable.organizationId, orgId))
      .groupBy(requestTable.status),

    // Top request types by volume
    db
      .select({
        title: requestType.title,
        slug: requestType.slug,
        n: count(requestTable.id),
      })
      .from(requestTable)
      .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
      .where(eq(requestTable.organizationId, orgId))
      .groupBy(requestType.title, requestType.slug)
      .orderBy(desc(count(requestTable.id)))
      .limit(8),

    // Daily request volume last 30 days
    db
      .select({
        day: sql<string>`date_trunc('day', ${requestTable.createdAt})::date`.as("day"),
        n: count(),
      })
      .from(requestTable)
      .where(
        and(
          eq(requestTable.organizationId, orgId),
          gte(requestTable.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`date_trunc('day', ${requestTable.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${requestTable.createdAt})::date`),

    // Avg time from creation to decision (hours)
    db
      .select({
        avgMs: sql<number>`
          avg(extract(epoch from (${approval.decidedAt} - ${requestTable.createdAt})) * 1000)
        `.as("avg_ms"),
      })
      .from(approval)
      .innerJoin(requestTable, eq(approval.requestId, requestTable.id))
      .where(
        and(
          eq(requestTable.organizationId, orgId),
          sql`${approval.decision} in ('approved', 'denied')`,
        ),
      ),
  ]);

  const totalRequests = statusCounts.reduce((sum, r) => sum + Number(r.n), 0);
  const approvedCount = statusCounts.find((r) => r.status === "approved")?.n ?? 0;
  const pendingCount = statusCounts.find((r) => r.status === "pending_approval")?.n ?? 0;
  const avgHours =
    avgDecisionMs[0]?.avgMs
      ? (Number(avgDecisionMs[0].avgMs) / 1000 / 3600).toFixed(1)
      : null;

  const maxDaily = Math.max(1, ...recentVolume.map((d) => Number(d.n)));

  const statusBarColor: Record<string, string> = {
    pending_approval: "var(--status-pending)",
    approved: "var(--status-approved)",
    denied: "var(--status-denied)",
    needs_info: "var(--status-pending)",
    fulfillment_pending: "var(--accent)",
    fulfilled: "var(--status-approved)",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          Request volume, approval metrics, and type breakdown for your
          organisation.
        </p>
      </div>

      <div className="flex justify-end">
        <Link
          href="/analytics/ai"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }}
        >
          <Cpu className="h-4 w-4" />
          View AI Cost & Usage
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total requests", value: totalRequests },
          { label: "Approved", value: Number(approvedCount) },
          { label: "Pending approval", value: Number(pendingCount) },
          {
            label: "Avg. time to decision",
            value: avgHours ? `${avgHours} h` : "—",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <section className="rounded-lg border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold">Status breakdown</h2>
        <div className="mt-4 space-y-2.5">
          {statusCounts
            .sort((a, b) => Number(b.n) - Number(a.n))
            .map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-xs" style={{ color: "var(--ink-2)" }}>
                  {row.status.replace(/_/g, " ")}
                </div>
                <div className="flex-1 overflow-hidden rounded-full" style={{ background: "var(--subtle)" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.round((Number(row.n) / Math.max(1, totalRequests)) * 100)}%`,
                      background: statusBarColor[row.status] ?? "var(--ink-3)",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
                  {row.n}
                </span>
              </div>
            ))}
        </div>
      </section>

      {/* Daily volume chart (CSS-only sparkline) */}
      <section className="rounded-lg border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold">Daily volume — last 30 days</h2>
        {recentVolume.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--ink-3)" }}>No data yet.</p>
        ) : (
          <div className="mt-4 flex h-20 items-end gap-0.5">
            {recentVolume.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.n}`}
                className="flex-1 rounded-t"
                style={{
                  height: `${Math.round((Number(d.n) / maxDaily) * 100)}%`,
                  minHeight: "2px",
                  background: "var(--ink)",
                }}
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          {recentVolume.length} days with activity
        </p>
      </section>

      {/* Top request types */}
      <section className="rounded-lg border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold">Top request types</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-3)" }}>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 text-right font-medium">Requests</th>
              <th className="pb-2 pl-4 font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--line)" }}>
            {topTypes.map((t) => (
              <tr key={t.slug}>
                <td className="py-2 font-medium" style={{ color: "var(--ink)" }}>
                  {t.title}
                </td>
                <td className="py-2 text-right tabular-nums">{t.n}</td>
                <td className="py-2 pl-4">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--subtle)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((Number(t.n) / Math.max(1, totalRequests)) * 100)}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
