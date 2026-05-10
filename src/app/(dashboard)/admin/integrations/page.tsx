import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { IntegrationsForm } from "./integrations-form";

export default async function AdminIntegrationsPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;

  const [org] = await db
    .select({ webhookUrl: organization.webhookUrl, slackTeamId: organization.slackTeamId })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Outbound webhooks for approvals and provisioning events. Payloads are
          POSTed as JSON; when a signing secret is set, we add header{" "}
          <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
            X-Governance-Signature
          </code>{" "}
          with HMAC-SHA256 of the raw body.
        </p>
      </div>

      <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", color: "var(--ink-2)" }}>
        <p className="font-medium" style={{ color: "var(--ink)" }}>In plain English</p>
        <p className="mt-1">
          This page configures <strong>outbound notifications</strong>: when
          something important happens here (for example, an approval or a
          provisioning step), we can POST a JSON payload to your URL so Slack,
          ServiceNow, or a custom script can react. It does not grant inbound
          access to your data—that’s what API keys are for.
        </p>
      </div>

      <IntegrationsForm initialUrl={org?.webhookUrl ?? ""} initialSlackTeamId={org?.slackTeamId ?? ""} />
    </div>
  );
}
