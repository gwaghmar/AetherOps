import Link from "next/link";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { ensureOrganizationOnboardingRow } from "@/app/actions/ai-org";
import { HomeCopilot } from "@/components/home-copilot";
import { CatalogGroupedTiles } from "@/components/catalog-grouped-tiles";
import { db } from "@/db";
import { approval, organizationOnboarding, request } from "@/db/schema";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";
import { getRecentUserTickets } from "@/server/recent-tickets";
import { requireSession } from "@/lib/session";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { SparklesText } from "@/components/magicui/sparkles-text";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  change,
  sparkle = false,
}: {
  label: string;
  value: string;
  change?: string;
  sparkle?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg p-[13px_15px] border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {/* Magic UI: subtle orange gradient wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 3%, transparent) 0%, transparent 60%)",
        }}
      />
      <p
        className="text-[10.5px] font-medium uppercase tracking-[0.01em] mb-[5px]"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </p>
      {sparkle ? (
        <SparklesText
          text={value}
          className="text-[25px] font-semibold tracking-[-0.04em] leading-none tabular-nums"
        />
      ) : (
        <p
          className="text-[25px] font-semibold tracking-[-0.04em] leading-none tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {value}
        </p>
      )}
      {change && (
        <p className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>{change}</span>
        </p>
      )}
    </div>
  );
}

export default async function HomePage() {
  const session = await requireSession();
  const orgId = session.user.organizationId;
  const role = session.user.role;
  const isAdmin = role === "admin";

  const catalog = orgId ? await fetchOrgCatalogTiles(orgId) : [];

  let onboardingIncomplete = false;
  let recentForCopilot: { kind: "request" | "change"; id: string; title: string; status: string }[] = [];
  let openRequestsCount = 0;
  let pendingApprovalsCount = 0;
  let fulfilledThisMonthCount = 0;

  if (orgId) {
    await ensureOrganizationOnboardingRow(orgId);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [openRow, approvalRow, fulfilledRow] = await Promise.all([
      db
        .select({ n: count() })
        .from(request)
        .where(
          and(
            eq(request.requesterId, session.user.id),
            eq(request.organizationId, orgId),
            inArray(request.status, ["pending_approval", "approved"]),
          ),
        ),
      db
        .select({ n: count() })
        .from(approval)
        .where(
          and(
            eq(approval.approverId, session.user.id),
            eq(approval.decision, "pending"),
          ),
        ),
      db
        .select({ n: count() })
        .from(request)
        .where(
          and(
            eq(request.organizationId, orgId),
            eq(request.status, "fulfilled"),
            gte(request.updatedAt, monthStart),
          ),
        ),
    ]);
    openRequestsCount = Number(openRow[0]?.n ?? 0);
    pendingApprovalsCount = Number(approvalRow[0]?.n ?? 0);
    fulfilledThisMonthCount = Number(fulfilledRow[0]?.n ?? 0);
    const [onb] = await db
      .select({ wizardCompletedAt: organizationOnboarding.wizardCompletedAt })
      .from(organizationOnboarding)
      .where(eq(organizationOnboarding.organizationId, orgId))
      .limit(1);
    onboardingIncomplete = isAdmin && !onb?.wizardCompletedAt;

    const recent = await getRecentUserTickets(session.user.id, orgId, 3);
    recentForCopilot = recent.map((t) => ({ kind: t.kind, id: t.id, title: t.title, status: t.status }));
  }

  return (
    <div className="dot-grid relative min-h-full -m-6 md:-m-7 p-6 md:p-7">
      <div className="relative z-10 space-y-8 max-w-4xl">

        {/* Page header */}
        <div>
          <h1
            className="text-[17px] font-semibold tracking-[-0.03em]"
            style={{ color: "var(--ink)" }}
          >
            Welcome back, {session.user.name ?? session.user.email}.
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
            Your AI operations are running — browse the catalog or ask the AI to provision instantly.
          </p>
        </div>

        {/* Admin notice */}
        {isAdmin && (
          <div
            className="rounded-lg border px-4 py-3 flex gap-3 items-start text-[12px]"
            style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ink-3)" }} />
            <span>
              <strong style={{ color: "var(--ink)" }}>Admin view active.</strong>{" "}
              Log in as a non-admin to preview the standard employee view.
            </span>
          </div>
        )}

        {/* No org error */}
        {!orgId ? (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3"
            style={{ background: "var(--surface)", borderColor: "var(--status-denied)", color: "var(--status-denied)" }}
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">Your account has no organization assigned.</p>
          </div>
        ) : (
          <>
            {/* Onboarding prompt */}
            {onboardingIncomplete && (
              <div
                className="rounded-lg border px-4 py-3"
                style={{ background: "var(--surface)", borderColor: "var(--accent)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  Complete organization setup
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
                  Run the guided wizard to connect AI, seed your catalog, and invite your team.
                </p>
                <Link
                  href="/onboarding"
                  className="mt-3 inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)" }}
                >
                  Open onboarding
                </Link>
              </div>
            )}

            {/* Stat cards — 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <StatCard
                label="My open requests"
                value={String(openRequestsCount)}
                change={openRequestsCount === 0 ? "None pending" : `${openRequestsCount} in progress`}
              />
              <StatCard
                label="Pending approvals"
                value={String(pendingApprovalsCount)}
                change={pendingApprovalsCount === 0 ? "All clear" : `${pendingApprovalsCount} need action`}
                sparkle={pendingApprovalsCount > 0}
              />
              <StatCard
                label="Fulfilled this month"
                value={String(fulfilledThisMonthCount)}
                change={fulfilledThisMonthCount === 0 ? "—" : "↑ completed"}
              />
            </div>

            {/* Empty catalog hint */}
            {catalog.length === 0 && isAdmin && (
              <div
                className="rounded-lg border px-4 py-3 text-[12px]"
                style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}
              >
                <p className="font-semibold" style={{ color: "var(--ink)" }}>No catalog available</p>
                <p className="mt-1">
                  Use{" "}
                  <Link href="/onboarding" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                    onboarding
                  </Link>{" "}
                  to generate types with AI or apply a template.
                </p>
              </div>
            )}

            {/* Service catalog */}
            <section aria-label="Service catalog">
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-3"
                style={{ color: "var(--ink-3)" }}
              >
                Service catalog
              </h2>
              <CatalogGroupedTiles catalog={catalog} />
            </section>

            {/* AI Copilot */}
            <HomeCopilot
              recentTickets={recentForCopilot}
              onboardingIncomplete={onboardingIncomplete}
            />
          </>
        )}
      </div>
    </div>
  );
}
