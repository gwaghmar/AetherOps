import { requireSession } from "@/lib/session";
import { getAuditEvents } from "@/server/audit";
import { format } from "date-fns";

export default async function AuditLogPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p className="text-red-600">Admin only.</p>;
  }

  const events = await getAuditEvents({
    organizationId: session.user.organizationId!,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Recent administrative and system actions across the organization.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Action</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actor</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Entity</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950">
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {event.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {event.actor?.name || "System"}
                    <br />
                    <span className="text-xs opacity-70">{event.actor?.email}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {event.entityType}: {event.entityId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {format(event.createdAt, "MMM d, yyyy HH:mm")}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No audit events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
