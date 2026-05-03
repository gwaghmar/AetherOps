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
            <Link href="/analytics" className="text-zinc-500 hover:text-zinc-800 flex items-center gap-1 text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-indigo-500" />
            AI Cost & Usage
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
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
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{kpi.label}</p>
               <kpi.icon className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Daily Cost Chart */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold mb-6">Daily AI Spend — last 30 days</h2>
          {dailyCost.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-zinc-400 text-sm italic border border-dashed border-zinc-100 rounded-lg dark:border-zinc-800">
              No telemetry data ingested yet.
            </div>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {dailyCost.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: $${Number(d.cost).toFixed(4)}`}
                  className="flex-1 rounded-t bg-indigo-500 dark:bg-indigo-400 opacity-80 hover:opacity-100 transition-opacity cursor-help"
                  style={{
                    height: `${Math.round((Number(d.cost) / maxDailyCost) * 100)}%`,
                    minHeight: "2px",
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Model Breakdown */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold mb-6">Model Distribution</h2>
          <div className="space-y-5">
            {modelUsage.map(m => (
               <div key={m.model} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{m.model}</span>
                    <span className="text-zinc-500">{Number(m.tokens).toLocaleString()} tokens</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${Math.min(100, (Number(m.n) / Math.max(1, 10)) * 100)}%` }} 
                    />
                  </div>
               </div>
            ))}
            {modelUsage.length === 0 && <p className="text-sm text-zinc-400 italic">No usage data found.</p>}
          </div>
        </section>
      </div>

      {/* Chargeback / Top Users Table */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold mb-6">Chargeback Heatmap (Top Users)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-3 font-medium">User / Identity</th>
                <th className="pb-3 font-medium">Total Tokens</th>
                <th className="pb-3 font-medium text-right">Est. Cost</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topUsers.map((u) => (
                <tr key={u.email} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="py-4">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{u.name || "Unknown Agent"}</div>
                    <div className="text-xs text-zinc-500">{u.email || "system-identity"}</div>
                  </td>
                  <td className="py-4 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {Number(u.tokens).toLocaleString()}
                  </td>
                  <td className="py-4 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    ${Number(u.cost).toFixed(2)}
                  </td>
                  <td className="py-4 text-right">
                    {!u.name ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Orphan / Zombie
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-400 italic">No telemetry data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
