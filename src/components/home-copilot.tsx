"use client";

import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { requestStatusLabel } from "@/lib/status-labels";

const LAST_REQUEST_KEY = "governance_last_request_id";

export type CopilotRecentTicket = {
  kind: "request" | "change";
  id: string;
  title: string;
  status: string;
};

function messageText(m: { parts?: Array<{ type: string; text?: string }> }) {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export function HomeCopilot({
  recentTickets,
  onboardingIncomplete,
}: {
  recentTickets: CopilotRecentTicket[];
  onboardingIncomplete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lastRequestHref = useSyncExternalStore(
    () => () => {},
    () => {
      const id = window.localStorage.getItem(LAST_REQUEST_KEY);
      return id ? `/requests/${id}` : null;
    },
    () => null,
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const [input, setInput] = useState("");
  const dialogTitleId = useId();
  const dialogId = "home-copilot-dialog";

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
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        Copilot
      </button>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed bottom-4 right-4 z-30 flex h-[min(32rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-xl border shadow-xl"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "var(--line)" }}
          >
            <span id={dialogTitleId} className="text-sm font-medium">
              Copilot
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close copilot panel"
              className="text-xs"
              style={{ color: "var(--ink-3)" }}
            >
              Close
            </button>
          </div>
          <div
            className="border-b px-3 py-2 text-xs"
            style={{ borderColor: "var(--line)" }}
            role="navigation"
            aria-label="Copilot quick actions"
          >
            <p className="font-medium" style={{ color: "var(--ink-2)" }}>
              Quick actions
            </p>
            <div className="mt-1 flex flex-col gap-1">
              <Link href="/requests/new" className="underline" style={{ color: "var(--accent)" }}>
                New request
              </Link>
              {onboardingIncomplete && (
                <Link href="/onboarding" className="underline" style={{ color: "var(--accent)" }}>
                  Resume onboarding
                </Link>
              )}
              <Link href="/requests" className="underline" style={{ color: "var(--accent)" }}>
                My requests
              </Link>
              {lastRequestHref && (
                <Link href={lastRequestHref} className="underline" style={{ color: "var(--accent)" }}>
                  Where you left off
                </Link>
              )}
            </div>
            {recentTickets.length > 0 && (
              <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
                <p className="font-medium" style={{ color: "var(--ink-2)" }}>
                  Your recent tickets
                </p>
                <ul className="mt-1 space-y-1">
                  {recentTickets.map((t) => (
                    <li key={`${t.kind}-${t.id}`}>
                      <Link
                        href={
                          t.kind === "request"
                            ? `/requests/${t.id}`
                            : `/changes/${t.id}`
                        }
                        className="line-clamp-2 underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {t.kind === "request" ? "Request" : "Change"}: {t.title}{" "}
                        <span style={{ color: "var(--ink-3)" }}>
                          ({requestStatusLabel(t.status)})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
                    ? { background: "var(--subtle)" }
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
                  ? "AI not configured — open Admin → AI."
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
              aria-label="Ask Copilot"
              placeholder="Ask anything…"
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
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
