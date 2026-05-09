import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { UserRoleForm } from "./user-role-form";
import { OffboardButton } from "./offboard-button";

export default async function AdminUsersPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;

  const members = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
    .from(user)
    .where(eq(user.organizationId, orgId))
    .orderBy(asc(user.email));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Assign approvers and additional admins. The first person to sign up
          becomes admin automatically.
        </p>
      </div>
      <ul className="divide-y rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{m.name || "—"}</div>
              <div className="text-sm" style={{ color: "var(--ink-3)" }}>{m.email}</div>
              <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                Current: {m.role ?? "requester"}
              </div>
            </div>
            {m.id === session.user.id ? (
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>This is you</span>
            ) : (
              <div className="flex items-center gap-3">
                <UserRoleForm
                  userId={m.id}
                  currentRole={m.role ?? "requester"}
                />
                <OffboardButton userId={m.id} userName={m.name} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
