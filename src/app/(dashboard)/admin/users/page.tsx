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
    return <p className="text-red-600">Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p className="text-red-600">No organization.</p>;

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
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Assign approvers and additional admins. The first person to sign up
          becomes admin automatically.
        </p>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{m.name || "—"}</div>
              <div className="text-sm text-zinc-500">{m.email}</div>
              <div className="text-xs text-zinc-400">
                Current: {m.role ?? "requester"}
              </div>
            </div>
            {m.id === session.user.id ? (
              <span className="text-xs text-zinc-500">This is you</span>
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
