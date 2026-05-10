"use client";

import { useId, useState } from "react";

export function EmailApprovalConfirm({
  token,
  isApprove,
  typeTitle,
  requesterLine,
  extraLines,
}: {
  token: string;
  isApprove: boolean;
  typeTitle: string;
  requesterLine: string;
  extraLines: string[];
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "err">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");
  const errorId = useId();

  async function submit() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/approvals/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(data.error ?? "Request failed");
        return;
      }
      setStatus("done");
      setMessage("Your decision was recorded. You can close this tab.");
    } catch {
      setStatus("err");
      setMessage("Network error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm" style={{ color: "var(--status-approved)" }}>{message}</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        <strong style={{ color: "var(--ink)" }}>{typeTitle}</strong>
      </p>
      <p className="text-sm">{requesterLine}</p>
      {extraLines.map((line) => (
        <p key={line} className="text-sm" style={{ color: "var(--ink-2)" }}>
          {line}
        </p>
      ))}
      {status === "err" ? (
        <p id={errorId} className="text-sm" style={{ color: "var(--status-denied)" }} role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        aria-describedby={status === "err" ? errorId : undefined}
        onClick={() => void submit()}
        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={!isApprove
          ? { border: "1px solid color-mix(in srgb, var(--status-denied) 30%, transparent)", background: "color-mix(in srgb, var(--status-denied) 8%, transparent)", color: "var(--status-denied)" }
          : { background: "var(--status-approved)", color: "#fff" }
        }
      >
        {status === "loading"
          ? "Working…"
          : isApprove
            ? "Confirm approval"
            : "Confirm decline"}
      </button>
    </div>
  );
}
