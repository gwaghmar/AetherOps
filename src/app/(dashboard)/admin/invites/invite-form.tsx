"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateInvite } from "@/app/actions/ai-org";
import { useToast } from "@/components/toast";
import { getPublicAppUrl } from "@/lib/env";

type Role = "requester" | "approver" | "admin";

export function InviteForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("requester");
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, setPending] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formId = useId();
  const errorId = `${formId}-error`;
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="rounded-xl border p-5"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        aria-describedby={error ? errorId : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLastUrl(null);
          setPending(true);
          try {
            const res = await adminCreateInvite({ email, role, sendEmail });
            setLastUrl(res.signupUrl);
            setEmail("");
            toast(
              sendEmail
                ? `Invite sent to ${email}`
                : `Invite link generated for ${email}`,
              "success",
            );
            router.refresh();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to create invite";
            setError(msg);
            toast(msg, "error");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-sm font-semibold">Create invite</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-email`} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
              Email address
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-role`} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
              Role
            </label>
            <select
              id={`${formId}-role`}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <option value="requester">Requester</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="rounded"
            style={{ borderColor: "var(--line)" }}
          />
          Send email invite automatically
        </label>
        {error && (
          <p id={errorId} className="mt-2 text-sm" style={{ color: "var(--status-denied)" }} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
        >
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>

      {lastUrl && (
        <div className="rounded-lg border p-4" style={{ borderColor: "color-mix(in srgb, var(--status-approved) 25%, transparent)", background: "color-mix(in srgb, var(--status-approved) 8%, transparent)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--status-approved)" }}>Invite link ready</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Share this link with the invitee. It expires in 14 days.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              {lastUrl}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(lastUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: "color-mix(in srgb, var(--status-approved) 30%, transparent)", color: "var(--status-approved)" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
