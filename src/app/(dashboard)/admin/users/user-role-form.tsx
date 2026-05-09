"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminSetUserRole } from "@/app/actions/admin";

const ROLES = ["requester", "approver", "admin"] as const;

export function UserRoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        setPending(true);
        try {
          await adminSetUserRole({ userId, role });
          setMsg("Saved.");
          router.refresh();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Failed");
        }
        setPending(false);
      }}
    >
      <label htmlFor={`role-${userId}`} className="sr-only">
        Role
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-lg border px-2 py-1 text-sm"
        style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || role === currentRole}
        className="rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-40"
        style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
      >
        Update
      </button>
      {msg && (
        <span
          style={{ fontSize: "0.75rem", color: msg === "Saved." ? "var(--status-approved)" : "var(--status-denied)" }}
        >
          {msg}
        </span>
      )}
    </form>
  );
}
