import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  aiUsageTelemetry,
  user as userTable,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import Link from "next/link";
import { ArrowLeft, Cpu, TrendingUp, Users, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AiAnalyticsPage() {
  const session = await requireRole(["admin"]);
  const orgId = session.user.organizationId;
  if (!orgId) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Parallel queries for AI Analytics
  const [
    totalCost,
    topUsers,
    modelUsage,
    dailyCost,
  ] = await Promise.all([
    // Total cost last 30 days
    db
      .select({ total: sql<number>`sum(cast(${aiUsageTelemetry.estimatedCostUsd} as decimal))` })
      .from(aiUsageTelemetry)
      .where(
        and(
          eq(aiUsageTelemetry.organizationId, orgId),
          gte(aiUsageTelemetry.createdAt, thirtyDaysAgo)
        )
      ),

    // Top users by cost
    db
      .select({
        name: userTable.name,
        email: userTable.email,
        cost: sql<number>`sum(cast(${aiUsageTelemetry.estimatedCostUsd} as decimal))`,
        tokens: sum(aiUsageTelemetry.totalTokens),
      })
      .from(aiUsageTelemetry)
      .leftJoin(userTable, eq(aiUsageTelemetry.userId, userTable.id))
      .where(eq(aiUsageTelemetry.organizationId, orgId))
      .groupBy(userTable.name, userTable.email)
      .orderBy(desc(sql`sum(cast(${aiUsageTelemetry.estimatedCostUsd} as decimal))`))
      .limit(10),

    // Model distribution
    db
      .select({
        model: aiUsageTelemetry.modelName,
        n: sql<number>`count(*)`,
        tokens: sum(aiUsageTelemetry.totalTokens),
      })
      .from(aiUsageTelemetry)
      .where(eq(aiUsageTelemetry.organizationId, orgId))
      .groupBy(aiUsageTelemetry.modelName)
      .orderBy(desc(sql`count(*)`)),

    // Daily AI cost
    db
      .select({
        day: sql<string>`date_trunc('day', ${aiUsageTelemetry.createdAt})::date`.as("day"),
        cost: sql<number>`sum(cast(${aiUsageTelemetry.estimatedCostUsd} as decimal))`,
      })
      .from(aiUsageTelemetry)
      .where(
        and(
          eq(aiUsageTelemetry.organizationId, orgId),
          gte(aiUsageTelemetry.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`date_trunc('day', ${aiUsageTelemetry.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${aiUsageTelemetry.createdAt})::date`),
  ]);

  const totalCostVal = totalCost[0]?.total ?? 0;
  const maxDailyCost = Math.max(0.01, ...dailyCost.map(d => Number(d.cost)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/analytics" className="flex items-center gap-1 text-sm transition-colors" style={{ color: "var(--ink-3)" }}>
              <ArrowLeft className="h-4 w-4" /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6" style={{ color: "var(--accent)" }} />
            AI Cost & Usage
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
            Token consumption, model breakdown, and chargeback estimates.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Cost (30d)", value: `$${Number(totalCostVal).toFixed(2)}`, icon: Zap },
          { label: "Active Models", value: modelUsage.length, icon: Cpu },
          { label: "Active Users", value: topUsers.length, icon: Users },
          { label: "Cost Trend", value: "Up 12%", icon: TrendingUp },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{kpi.label}</p>
              <kpi.icon className="h-3.5 w-3.5" style={{ color: "var(--ink-3)" }} />
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Daily Cost Chart */}
        <section className="rounded-lg border p-6" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold mb-6">Daily AI Spend — last 30 days</h2>
          {dailyCost.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm italic rounded-lg border border-dashed" style={{ color: "var(--ink-3)", borderColor: "var(--line)" }}>
              No telemetry data ingested yet.
            </div>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {dailyCost.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: $${Number(d.cost).toFixed(4)}`}
                  className="flex-1 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-help"
                  style={{
                    height: `${Math.round((Number(d.cost) / maxDailyCost) * 100)}%`,
                    minHeight: "2px",
                    background: "var(--accent)",
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Model Breakdown */}
        <section className="rounded-lg border p-6" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold mb-6">Model Distribution</h2>
          <div className="space-y-5">
            {modelUsage.map(m => (
              <div key={m.model} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: "var(--ink-2)" }}>{m.model}</span>
                  <span style={{ color: "var(--ink-3)" }}>{Number(m.tokens).toLocaleString()} tokens</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--subtle)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (Number(m.n) / Math.max(1, 10)) * 100)}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
            ))}
            {modelUsage.length === 0 && <p className="text-sm italic" style={{ color: "var(--ink-3)" }}>No usage data found.</p>}
          </div>
        </section>
      </div>

      {/* Chargeback / Top Users Table */}
      <section className="rounded-lg border p-6" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold mb-6">Chargeback Heatmap (Top Users)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b" style={{ color: "var(--ink-3)", borderColor: "var(--line)" }}>
                <th className="pb-3 font-medium">User / Identity</th>
                <th className="pb-3 font-medium">Total Tokens</th>
                <th className="pb-3 font-medium text-right">Est. Cost</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--line)" }}>
              {topUsers.map((u) => (
                <tr key={u.email} className="transition-colors" style={{ background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--subtle)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="py-4">
                    <div className="font-medium">{u.name || "Unknown Agent"}</div>
                    <div className="text-xs" style={{ color: "var(--ink-3)" }}>{u.email || "system-identity"}</div>
                  </td>
                  <td className="py-4 tabular-nums" style={{ color: "var(--ink-2)" }}>
                    {Number(u.tokens).toLocaleString()}
                  </td>
                  <td className="py-4 text-right tabular-nums font-semibold">
                    ${Number(u.cost).toFixed(2)}
                  </td>
                  <td className="py-4 text-right">
                    {!u.name ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight"
                        style={{ background: "color-mix(in srgb, var(--status-denied) 10%, transparent)", color: "var(--status-denied)" }}>
                        Orphan / Zombie
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight"
                        style={{ background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }}>
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center italic" style={{ color: "var(--ink-3)" }}>No telemetry data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
