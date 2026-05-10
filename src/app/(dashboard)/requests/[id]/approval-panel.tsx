"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { decideApprovalAction } from "@/app/actions/requests";
import { useToast } from "@/components/toast";

export function ApprovalPanel({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorId = useId();

  async function act(decision: "approved" | "denied" | "needs_info") {
    setError(null);
    setPending(true);
    try {
      await decideApprovalAction({ requestId, decision, comment });
      const label = decision === "approved" ? "Approved" : decision === "denied" ? "Denied" : "Sent back for info";
      toast(label, decision === "approved" ? "success" : "info");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      toast(e instanceof Error ? e.message : "Action failed", "error");
      setPending(false);
    }
  }

  return (
    <section
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
      aria-labelledby={`approval-actions-${requestId}`}
    >
      <h2 id={`approval-actions-${requestId}`} className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
        Approver actions
      </h2>
      <label htmlFor={`${errorId}-comment`} className="sr-only">
        Optional comment for approver decision
      </label>
      <textarea
        id={`${errorId}-comment`}
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="mt-3 w-full rounded-lg px-3 py-2 text-sm"
        style={{ border: "1px solid var(--line)", background: "var(--subtle)", color: "var(--ink)" }}
      />
      {error && (
        <p id={errorId} className="mt-2 text-sm" style={{ color: "var(--status-denied)" }} role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("approved")}
          aria-busy={pending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--status-approved)", color: "#fff" }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("denied")}
          aria-busy={pending}
          className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
        >
          Deny
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("needs_info")}
          aria-busy={pending}
          className="rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
        >
          Needs info
        </button>
      </div>
    </section>
  );
}
