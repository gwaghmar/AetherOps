import { requireSession } from "@/lib/session";
import { getOrgAiSettingsMasked } from "@/app/actions/ai-org";
import { AiSettingsForm } from "./ai-settings-form";

export default async function AdminAiPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }

  const initial = await getOrgAiSettingsMasked();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI connection</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Configure how this organization calls the language model for onboarding
          and the home copilot. Keys are stored encrypted when{" "}
          <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
            FIELD_ENCRYPTION_KEY
          </code>{" "}
          is set.
        </p>
      </div>
      <AiSettingsForm initial={initial} />
    </div>
  );
}
