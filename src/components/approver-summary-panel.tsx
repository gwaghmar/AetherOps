"use client";

import { useState, useTransition } from "react";
import { generateApproverSummaryAction } from "@/app/actions/ai-approver-summary";

export function ApproverSummaryPanel({ requestId }: { requestId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section
      className="rounded-xl border p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
        background: "color-mix(in srgb, var(--accent) 6%, transparent)",
      }}
    >
      <h2 className="text-sm font-semibold">AI review summary</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
        Short bullets to speed up review—not a decision. You still approve or
        deny based on policy.
      </p>
      {summary ? (
        <div
          className="mt-3 whitespace-pre-wrap rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--subtle)" }}
        >
          {summary}
        </div>
      ) : null}
      {msg && (
        <p
          className="mt-2 text-xs"
          style={{ color: summary ? "var(--ink-3)" : "var(--status-denied)" }}
        >
          {msg}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          setSummary(null);
          startTransition(async () => {
            const r = await generateApproverSummaryAction({ requestId });
            if (r.ok) {
              setSummary(r.summary);
              setMsg(
                r.usedPlatformFallback
                  ? "This used the platform fallback API key (see audit export)."
                  : null,
              );
            } else {
              setMsg(r.error);
            }
          });
        }}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
      >
        {pending ? "Generating…" : summary ? "Regenerate" : "Generate summary"}
      </button>
    </section>
  );
}
