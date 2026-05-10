"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminAddRoutingRule,
  adminDeleteRoutingRule,
} from "@/app/actions/admin";

export function RoutingAdminClient({
  types,
  approvers,
  rules,
}: {
  types: { id: string; title: string; slug: string }[];
  approvers: { id: string; email: string }[];
  rules: {
    id: string;
    sortOrder: number;
    requestTypeId: string | null;
    typeTitle: string | null;
    approverEmail: string;
  }[];
}) {
  const router = useRouter();
  const [typeId, setTypeId] = useState<string>("__all__");
  const [approverId, setApproverId] = useState(approvers[0]?.id ?? "");
  const [sortOrder, setSortOrder] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Add rule</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          Rules for a specific catalog type are tried first (lowest sort order
          first), then org-wide fallback rules with no type. New requests assign
          the first approver in the resolved pool and record the full pool for
          routing checks.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            if (!approverId) {
              setMsg("Add an approver user first under Users.");
              return;
            }
            setPending(true);
            try {
              await adminAddRoutingRule({
                requestTypeId: typeId === "__all__" ? null : typeId,
                approverUserId: approverId,
                sortOrder,
              });
              setMsg("Saved.");
              router.refresh();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Failed");
            }
            setPending(false);
          }}
        >
          <div>
            <label
              htmlFor="routing-type"
              className="block text-xs font-medium"
              style={{ color: "var(--ink-3)" }}
            >
              Request type
            </label>
            <select
              id="routing-type"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="mt-1 w-full min-w-[12rem] rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <option value="__all__">All types (org fallback)</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="routing-approver"
              className="block text-xs font-medium"
              style={{ color: "var(--ink-3)" }}
            >
              Approver
            </label>
            <select
              id="routing-approver"
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="mt-1 w-full min-w-[12rem] rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              {approvers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="routing-sort"
              className="block text-xs font-medium"
              style={{ color: "var(--ink-3)" }}
            >
              Sort order
            </label>
            <input
              id="routing-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              className="mt-1 w-24 rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            />
          </div>
          <button
            type="submit"
            disabled={pending || !approverId}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: "var(--line)" }}
          >
            Add rule
          </button>
        </form>
        {msg && <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>{msg}</p>}
      </section>

      <section>
        <h2 className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Current rules</h2>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-3)" }}>
            No routing rules — the first approver in the org (by email) is used.
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border" style={{ borderColor: "var(--line)" }}>
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                <div>
                  <span className="font-medium">
                    {r.typeTitle ?? "All types (fallback)"}
                  </span>
                  <span style={{ color: "var(--ink-3)" }}> → </span>
                  <span>{r.approverEmail}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--ink-3)" }}>
                    order {r.sortOrder}
                  </span>
                </div>
                <DeleteRuleButton ruleId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        className="rounded border border-red-200 px-2 py-0.5 text-xs disabled:opacity-40"
        style={{ color: "var(--status-denied)" }}
        onClick={async () => {
          setPending(true);
          setErr(null);
          try {
            await adminDeleteRoutingRule({ id: ruleId });
            router.refresh();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to remove rule");
            setPending(false);
          }
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {err && (
        <span className="text-xs" style={{ color: "var(--status-denied)" }}>{err}</span>
      )}
    </span>
  );
}
