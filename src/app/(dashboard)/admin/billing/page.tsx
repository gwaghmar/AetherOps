import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { PLANS, isStripeConfigured, type PlanKey } from "@/lib/stripe";

export default async function BillingPage() {
  const session = await requireRole(["admin"]);
  const orgId = session.user.organizationId!;

  const [org] = await db
    .select({
      name: organization.name,
      stripeCustomerId: organization.stripeCustomerId,
      stripeSubscriptionStatus: organization.stripeSubscriptionStatus,
      stripePriceId: organization.stripePriceId,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  const stripeReady = isStripeConfigured();
  const currentPriceId = org?.stripePriceId;
  const status = org?.stripeSubscriptionStatus;

  function currentPlanKey(): PlanKey | null {
    if (!currentPriceId) return null;
    for (const [key, plan] of Object.entries(PLANS)) {
      if (plan.price_id && plan.price_id === currentPriceId) {
        return key as PlanKey;
      }
    }
    return null;
  }
  const activePlan = currentPlanKey();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          Manage your subscription and usage limits.
        </p>
      </div>

      {/* Current subscription */}
      {activePlan && status && (
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold">Current subscription</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }}>
              {status}
            </span>
            <span className="font-medium">{PLANS[activePlan].name}</span>
            <span className="text-sm" style={{ color: "var(--ink-3)" }}>
              {PLANS[activePlan].price_display}
            </span>
          </div>
          {stripeReady && org?.stripeCustomerId && (
            <form
              action="/api/stripe/portal"
              method="POST"
              className="mt-4"
            >
              <input type="hidden" name="orgId" value={orgId} />
              <button
                type="submit"
                className="rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                Manage subscription →
              </button>
            </form>
          )}
        </div>
      )}

      {/* Plan comparison */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(
          ([key, plan]) => {
            const isCurrent = key === activePlan;
            return (
              <div
                key={key}
                className="rounded-xl border p-5"
                style={isCurrent
                  ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }
                  : { borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {plan.price_display}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm" style={{ color: "var(--ink-2)" }}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <span style={{ color: "var(--status-approved)" }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && stripeReady && plan.price_id && (
                  <form action="/api/stripe/checkout" method="POST" className="mt-4">
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="priceId" value={plan.price_id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg px-3 py-2 text-sm font-medium"
                      style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
                    >
                      {activePlan ? "Switch to " : "Start "}
                      {plan.name}
                    </button>
                  </form>
                )}
                {!isCurrent && key === "enterprise" && (
                  <a
                    href="mailto:sales@example.com?subject=Enterprise+inquiry"
                    className="mt-4 block w-full rounded-lg border px-3 py-2 text-center text-sm font-medium"
                    style={{ borderColor: "var(--line)" }}
                  >
                    Contact sales →
                  </a>
                )}
              </div>
            );
          },
        )}
      </div>

      {!stripeReady && (
        <div
          className="rounded-lg border p-6 max-w-lg"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            Billing not configured
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
            Add these environment variables in your Vercel project settings to activate billing:
          </p>
          <ul
            className="mt-3 space-y-1 text-xs font-mono rounded-md p-3"
            style={{ background: "var(--subtle)", color: "var(--ink-2)" }}
          >
            <li>STRIPE_SECRET_KEY</li>
            <li>STRIPE_WEBHOOK_SECRET</li>
            <li>STRIPE_STARTER_PRICE_ID</li>
            <li>STRIPE_GROWTH_PRICE_ID</li>
            <li>STRIPE_ENTERPRISE_PRICE_ID</li>
          </ul>
          <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
            After adding them, redeploy and return here to activate plans.
          </p>
        </div>
      )}
    </div>
  );
}
