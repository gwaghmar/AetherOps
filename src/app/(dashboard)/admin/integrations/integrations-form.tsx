"use client";

import { useState, useTransition } from "react";
import { adminUpdateOrgWebhooks, adminUpdateSlackTeamId } from "@/app/actions/admin";

export function IntegrationsForm({ initialUrl, initialSlackTeamId }: { initialUrl: string; initialSlackTeamId: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [secret, setSecret] = useState("");
  const [clearSecret, setClearSecret] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slackTeamId, setSlackTeamId] = useState(initialSlackTeamId);
  const [slackMsg, setSlackMsg] = useState<string | null>(null);
  const [slackPending, startSlackTransition] = useTransition();

  return (<>
    <form
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          try {
            await adminUpdateOrgWebhooks({
              webhookUrl: url,
              webhookSigningSecret: secret,
              clearSecret,
            });
            setSecret("");
            setClearSecret(false);
            setMsg("Saved.");
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <div>
        <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          Webhook URL
        </label>
        <input
          name="webhookUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
      </div>
      <div>
        <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          Signing secret (optional)
        </label>
        <input
          type="password"
          name="webhookSigningSecret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Leave blank to keep existing"
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
        <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={clearSecret}
            onChange={(e) => setClearSecret(e.target.checked)}
          />
          Remove stored signing secret
        </label>
      </div>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        When{" "}
        <code className="rounded px-1" style={{ background: "var(--subtle)" }}>FIELD_ENCRYPTION_KEY</code>{" "}
        is set, new secrets are encrypted at rest (app-level envelope; swap for
        KMS in production — see <code className="rounded px-1" style={{ background: "var(--subtle)" }}>src/lib/kms-envelope.ts</code>).
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
      >
        {pending ? "Saving…" : "Save webhooks"}
      </button>
      {msg ? (
        <p
          className="text-sm"
          style={{ color: msg === "Saved." ? "var(--status-approved)" : "var(--status-denied)" }}
        >
          {msg}
        </p>
      ) : null}
    </form>

    <form
      className="mt-8 max-w-lg space-y-4 border-t pt-8"
      style={{ borderColor: "var(--line)" }}
      onSubmit={(e) => {
        e.preventDefault();
        setSlackMsg(null);
        startSlackTransition(async () => {
          try {
            const result = await adminUpdateSlackTeamId({ slackTeamId });
            if (!result.ok) {
              setSlackMsg(result.error);
            } else {
              setSlackMsg("Saved.");
            }
          } catch (err) {
            setSlackMsg(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <h2 className="text-base font-semibold tracking-tight">Slack Integration</h2>
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Map your Slack workspace to this organization so the{" "}
        <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>/request</code>{" "}
        slash command resolves to the correct tenant.
      </p>
      <div>
        <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          Slack Team ID
        </label>
        <input
          name="slackTeamId"
          value={slackTeamId}
          onChange={(e) => setSlackTeamId(e.target.value)}
          placeholder="T0123ABCDEF"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          Find your Slack Team ID in your workspace URL or via the Slack API.
          Leave blank to remove the mapping.
        </p>
      </div>
      <button
        type="submit"
        disabled={slackPending}
        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
      >
        {slackPending ? "Saving…" : "Save Slack settings"}
      </button>
      {slackMsg ? (
        <p
          className="text-sm"
          style={{ color: slackMsg === "Saved." ? "var(--status-approved)" : "var(--status-denied)" }}
        >
          {slackMsg}
        </p>
      ) : null}
    </form>
  </>);
}
