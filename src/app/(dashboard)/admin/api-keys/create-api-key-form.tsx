"use client";

import { useState } from "react";
import { adminCreateApiKey } from "@/app/actions/admin";

export function CreateApiKeyForm() {
  const [name, setName] = useState("");
  const [allowedSlugs, setAllowedSlugs] = useState("");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (shownKey) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: "color-mix(in srgb, var(--status-approved) 25%, transparent)", background: "color-mix(in srgb, var(--status-approved) 8%, transparent)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-approved)" }}>
          API key created — copy it now. It will not be shown again.
        </p>
        <code className="mt-2 block break-all rounded px-2 py-1 text-xs" style={{ background: "var(--surface)" }}>
          {shownKey}
        </code>
        <button
          type="button"
          onClick={() => {
            setShownKey(null);
            setName("");
            setAllowedSlugs("");
          }}
          className="mt-3 text-sm underline"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          const res = await adminCreateApiKey({ name, allowedSlugs });
          if (res.ok && res.fullKey) setShownKey(res.fullKey);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
        setPending(false);
      }}
    >
      <div>
        <label htmlFor="api-key-name" className="text-xs font-medium">
          Label
        </label>
        <input
          id="api-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Staging agent"
          className="mt-1 block w-56 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
      </div>
      <div>
        <label htmlFor="api-key-slugs" className="text-xs font-medium">
          Allowed type slugs (comma-separated, optional)
        </label>
        <input
          id="api-key-slugs"
          value={allowedSlugs}
          onChange={(e) => setAllowedSlugs(e.target.value)}
          placeholder="e.g. github_access, aws_sso"
          className="mt-1 block w-64 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
      >
        Generate key
      </button>
      {error && <p className="w-full text-sm" style={{ color: "var(--status-denied)" }}>{error}</p>}
    </form>
  );
}
