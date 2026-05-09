"use client";

import { useState, useTransition } from "react";
import {
  getOrgAiSettingsMasked,
  runOrgAiConnectionTest,
  saveOrgAiSettings,
} from "@/app/actions/ai-org";

type Initial = Awaited<ReturnType<typeof getOrgAiSettingsMasked>>;

export function AiSettingsForm({ initial }: { initial: Initial }) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [testPending, startTest] = useTransition();

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        Bring your own API key (OpenAI, OpenRouter, Azure OpenAI-compatible).
        Set optional base URL for OpenRouter (
        <code className="rounded px-1" style={{ background: "var(--subtle)" }}>
          https://openrouter.ai/api/v1
        </code>
        ). If no org key is stored, the server can use{" "}
        <code className="rounded px-1" style={{ background: "var(--subtle)" }}>
          APP_AI_PLATFORM_API_KEY
        </code>{" "}
        when allowed (dev always; production requires{" "}
        <code className="rounded px-1" style={{ background: "var(--subtle)" }}>
          ALLOW_AI_PLATFORM_FALLBACK=true
        </code>
        ).
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            try {
              await saveOrgAiSettings({
                baseUrl: baseUrl || undefined,
                defaultModel,
                apiKey: apiKey.trim() || undefined,
                clearKey,
              });
              setApiKey("");
              setClearKey(false);
              setMsg("Saved.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Save failed");
            }
          });
        }}
      >
        <div>
          <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
            Base URL (optional)
          </label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Default: api.openai.com"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
            Model id
          </label>
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
            API key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              initial.hasStoredKey
                ? "Leave blank to keep existing key"
                : "sk-… or OpenRouter key"
            }
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          />
          {initial.keyLastFour ? (
            <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
              Stored key ends in …{initial.keyLastFour}
            </p>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--ink-2)" }}>
            <input
              type="checkbox"
              checked={clearKey}
              onChange={(e) => setClearKey(e.target.checked)}
            />
            Remove stored API key
          </label>
        </div>
        {msg && (
          <p
            className="text-sm"
            style={{ color: msg === "Saved." ? "var(--status-approved)" : "var(--status-denied)" }}
          >
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={testPending}
            onClick={() => {
              setMsg(null);
              startTest(async () => {
                try {
                  const r = await runOrgAiConnectionTest();
                  setMsg(
                    r.ok
                      ? `Test: ${r.message}${r.usedPlatformFallback ? " (platform fallback)" : ""}`
                      : `Test failed: ${r.message}`,
                  );
                } catch (err) {
                  setMsg(
                    err instanceof Error ? err.message : "Connection test failed",
                  );
                }
              });
            }}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--line)" }}
          >
            {testPending ? "Testing…" : "Test connection"}
          </button>
        </div>
      </form>
    </div>
  );
}
