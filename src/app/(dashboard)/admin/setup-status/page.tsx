import { and, count, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import {
  approvalRoutingRule,
  organization,
  organizationInvite,
  requestType,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { getOrgAiCredentials } from "@/server/ai/client";

function Row({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0" style={{ borderColor: "var(--line)" }}>
      <div>
        <p className="font-medium" style={{ color: "var(--ink)" }}>{label}</p>
        {detail ? (
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
            {detail}
          </p>
        ) : null}
      </div>
      <span
        className="shrink-0 text-sm font-medium"
        style={{ color: ok ? "var(--status-approved)" : "var(--status-denied)" }}
      >
        {ok ? "OK" : "Needs attention"}
      </span>
    </div>
  );
}

export default async function AdminSetupStatusPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;
  }

  let aiOk = false;
  try {
    await getOrgAiCredentials(orgId);
    aiOk = true;
  } catch {
    aiOk = Boolean(process.env.APP_AI_PLATFORM_API_KEY?.trim());
  }

  const [catalogRow] = await db
    .select({ n: count() })
    .from(requestType)
    .where(
      and(
        eq(requestType.organizationId, orgId),
        isNull(requestType.archivedAt),
      ),
    );
  const catalogOk = Number(catalogRow?.n ?? 0) > 0;

  const [routeRow] = await db
    .select({ n: count() })
    .from(approvalRoutingRule)
    .where(eq(approvalRoutingRule.organizationId, orgId));
  const routingOk = Number(routeRow?.n ?? 0) > 0;

  const emailOk = Boolean(process.env.RESEND_API_KEY?.trim());

  const [org] = await db
    .select({ webhookUrl: organization.webhookUrl })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  const webhookOk = Boolean(org?.webhookUrl?.trim());

  const [invRow] = await db
    .select({ n: count() })
    .from(organizationInvite)
    .where(
      and(
        eq(organizationInvite.organizationId, orgId),
        isNull(organizationInvite.acceptedAt),
      ),
    );
  const pendingInvites = Number(invRow?.n ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setup status</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Quick health check for this deployment. Yellow items are optional or
          need configuration.
        </p>
      </div>
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <Row
          ok={aiOk}
          label="AI (copilot & onboarding generation)"
          detail="Admin → AI (BYOK) or set APP_AI_PLATFORM_API_KEY; production fallback needs ALLOW_AI_PLATFORM_FALLBACK=true."
        />
        <Row
          ok={catalogOk}
          label="Service catalog"
          detail="At least one request type. Use onboarding or Admin → Catalog."
        />
        <Row
          ok={routingOk}
          label="Approval routing rules"
          detail="Admin → Routing. If empty, the app may still assign approvers from role-based fallbacks when possible."
        />
        <Row
          ok={emailOk}
          label="Transactional email"
          detail="RESEND_API_KEY + EMAIL_FROM for approval mail and invite sends."
        />
        <Row
          ok={webhookOk}
          label="Outbound webhook"
          detail="Optional: Admin → Integrations."
        />
        <div className="pt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          Pending invites (not yet accepted):{" "}
          <span className="font-medium" style={{ color: "var(--ink)" }}>
            {pendingInvites}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/onboarding?force=1"
          className="rounded-lg border px-3 py-2 font-medium"
          style={{ borderColor: "var(--line)" }}
        >
          Open onboarding wizard
        </Link>
        <Link
          href="/admin/ai"
          className="rounded-lg border px-3 py-2 font-medium"
          style={{ borderColor: "var(--line)" }}
        >
          AI settings
        </Link>
      </div>
    </div>
  );
}
