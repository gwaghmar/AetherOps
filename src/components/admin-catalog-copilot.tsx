"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

function messageText(m: { parts?: Array<{ type: string; text?: string }> }) {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export function AdminCatalogCopilot() {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();
  const dialogId = "admin-catalog-copilot-dialog";
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/admin-chat",
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const t = input.trim();
      if (!t) return;
      void sendMessage({ text: t });
      setInput("");
    },
    [input, sendMessage],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={dialogId}
        className="fixed bottom-4 right-4 z-20 rounded-full border px-4 py-2 text-sm font-medium shadow-md"
        style={{ borderColor: "var(--line)", background: "var(--subtle)" }}
      >
        Catalog help
      </button>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed bottom-4 right-4 z-30 flex h-[min(28rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-xl border shadow-xl"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "var(--line)" }}
          >
            <span id={dialogTitleId} className="text-sm font-medium">
              Catalog copilot
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close catalog copilot panel"
              className="text-xs"
              style={{ color: "var(--ink-3)" }}
            >
              Close
            </button>
          </div>
          <p
            className="border-b px-3 py-2 text-xs"
            style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
          >
            Ask about slugs, fields, risk defaults, or how to structure a new
            intent. Changes still go through the forms below.
          </p>
          <div
            className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm"
            role="log"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "ml-4 rounded-lg px-2 py-1" : "mr-4 rounded-lg border px-2 py-1"}
                style={
                  m.role === "user"
                    ? { background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                    : { borderColor: "var(--line)" }
                }
              >
                <span className="text-[10px] uppercase" style={{ color: "var(--ink-3)" }}>
                  {m.role}
                </span>
                <p className="whitespace-pre-wrap">{messageText(m)}</p>
              </div>
            ))}
            {status === "streaming" && (
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>Thinking…</p>
            )}
            {error && (
              <p className="text-xs" style={{ color: "var(--status-denied)" }}>
                {/ai_not_configured|503/i.test(String(error.message))
                  ? "AI not configured — Admin → AI."
                  : error.message}
              </p>
            )}
          </div>
          <form
            onSubmit={onSubmit}
            className="border-t p-2"
            style={{ borderColor: "var(--line)" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Ask catalog copilot"
              placeholder="Ask about the catalog…"
              className="w-full rounded-lg border px-2 py-1.5 text-sm bg-transparent"
              style={{ borderColor: "var(--line)" }}
            />
            <button
              type="submit"
              disabled={status === "streaming" || status === "submitted"}
              className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
            >
              {status === "streaming" || status === "submitted"
                ? "Sending…"
                : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
