import { adminListPendingInvites } from "@/app/actions/ai-org";
import { requireRole } from "@/lib/session";
import { InviteForm } from "./invite-form";

export default async function AdminInvitesPage() {
  await requireRole(["admin"]);
  const invites = await adminListPendingInvites();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Invite team members to join your organization. Invite links expire after 14 days.
        </p>
      </div>

      <InviteForm />

      <section>
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>
          Pending invites ({invites.length})
        </h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--ink-3)" }}>No pending invites.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: "var(--line)" }}
              >
                <div>
                  <div className="text-sm font-medium">{inv.email}</div>
                  <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                    Role: {inv.role ?? "requester"} ·{" "}
                    Expires:{" "}
                    {new Date(inv.expiresAt!).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: "color-mix(in srgb, var(--status-pending) 25%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }}>
                  Pending
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
