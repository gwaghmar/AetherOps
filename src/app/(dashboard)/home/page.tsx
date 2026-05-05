import Link from "next/link";
import { eq } from "drizzle-orm";
import { ensureOrganizationOnboardingRow } from "@/app/actions/ai-org";
import { HomeCopilot } from "@/components/home-copilot";
import { CatalogGroupedTiles } from "@/components/catalog-grouped-tiles";
import { db } from "@/db";
import { organizationOnboarding } from "@/db/schema";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";
import { getRecentUserTickets } from "@/server/recent-tickets";
import { requireSession } from "@/lib/session";
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid";
import { Clock, Zap, Activity, CheckCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { SparklesText } from "@/components/magicui/sparkles-text";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const orgId = session.user.organizationId;
  const role = session.user.role;
  const isAdmin = role === "admin";

  const catalog = orgId
    ? await fetchOrgCatalogTiles(orgId)
    : [];

  let onboardingIncomplete = false;
  let recentForCopilot: {
    kind: "request" | "change";
    id: string;
    title: string;
    status: string;
  }[] = [];

  if (orgId) {
    await ensureOrganizationOnboardingRow(orgId);
    const [onb] = await db
      .select({ wizardCompletedAt: organizationOnboarding.wizardCompletedAt })
      .from(organizationOnboarding)
      .where(eq(organizationOnboarding.organizationId, orgId))
      .limit(1);
    onboardingIncomplete = isAdmin && !onb?.wizardCompletedAt;

    const recent = await getRecentUserTickets(session.user.id, orgId, 3);
    recentForCopilot = recent.map((t) => ({
      kind: t.kind,
      id: t.id,
      title: t.title,
      status: t.status,
    }));
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Welcome back, {session.user.name}.
        </h1>
        <p className="text-neutral-500 max-w-2xl text-lg">
          Your AI operations are running smoothly. Browse the catalog or ask the AI to provision what you need instantly.
        </p>
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 shadow-sm flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 text-neutral-700 mt-0.5" />
          <div>
            <p className="font-semibold text-neutral-900">Admin View Active</p>
            <p className="mt-1 text-sm text-neutral-600">
              You are seeing all configuration options. To preview the standard employee view, log in with a non-admin account.
            </p>
          </div>
        </div>
      )}

      {!orgId ? (
        <div className="rounded-xl bg-red-50 p-6 border border-red-100 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-600" />
          <p className="text-red-800 font-medium text-lg">Your account has no organization assigned.</p>
        </div>
      ) : (
        <>
          {onboardingIncomplete && (
            <div className="rounded-xl border border-[--yc-orange] bg-orange-50/50 px-5 py-4 shadow-sm">
              <p className="font-semibold text-neutral-900">Complete Organization Setup</p>
              <p className="mt-1 text-sm text-neutral-600">
                Run the guided wizard to connect AI, seed your catalog, and invite your team.
              </p>
              <Link
                href="/onboarding"
                className="mt-3 inline-flex items-center justify-center rounded-full bg-[--yc-orange] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#E65C00] active:scale-95"
              >
                Open Onboarding
              </Link>
            </div>
          )}

          {/* New Dashboard Analytics (Bento Grid) */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-neutral-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[--yc-orange]" />
              Platform Pulse
            </h2>
            <BentoGrid className="auto-rows-[16rem]">
              <BentoCard
                name="Time Saved"
                description="Estimated human hours saved by AI automation this month."
                Icon={Clock}
                className="col-span-3 lg:col-span-1"
              >
                <div className="absolute bottom-6 right-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tighter text-neutral-900">42</span>
                  <span className="text-lg font-medium text-neutral-500">hrs</span>
                </div>
              </BentoCard>

              <BentoCard
                name="AI Agents Active"
                description="Live policies and fulfillment bots currently running."
                Icon={Zap}
                className="col-span-3 lg:col-span-1"
              >
                <div className="absolute bottom-6 right-6">
                  <SparklesText text="12 Online" className="text-3xl font-bold tracking-tight text-[--yc-orange]" />
                </div>
              </BentoCard>

              <BentoCard
                name="Recent Successes"
                description="Latest automated fulfillments across your organization."
                Icon={CheckCircle}
                className="col-span-3 lg:col-span-1"
              >
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-neutral-600 truncate">AWS Read-Only Provisioned</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-neutral-600 truncate">Linear Engineering Access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-60">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-neutral-600 truncate">Slack Guest Invite Sent</span>
                  </div>
                </div>
              </BentoCard>
            </BentoGrid>
          </section>

          {catalog.length === 0 && isAdmin && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm mt-8">
              <p className="font-semibold text-neutral-900">No Catalog Available</p>
              <p className="mt-1 text-neutral-600">
                Use <Link href="/onboarding" className="text-[--yc-orange] hover:underline font-medium">onboarding</Link> to generate types with AI or apply a template.
              </p>
            </div>
          )}

          <section aria-label="Service catalog by category" className="mt-12">
            <h2 className="text-xl font-semibold mb-6 text-neutral-900">Service Catalog</h2>
            <CatalogGroupedTiles catalog={catalog} />
          </section>

          <HomeCopilot
            recentTickets={recentForCopilot}
            onboardingIncomplete={onboardingIncomplete}
          />
        </>
      )}
    </div>
  );
}
