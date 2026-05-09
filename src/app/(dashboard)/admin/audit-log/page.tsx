import { requireSession } from "@/lib/session";
import { getAuditEvents } from "@/server/audit";
import { format } from "date-fns";

export default async function AuditLogPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }

  const events = await getAuditEvents({
    organizationId: session.user.organizationId!,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Recent administrative and system actions across the organization.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--line)", background: "var(--subtle)" }}>
                <th className="px-4 py-3 font-medium" style={{ color: "var(--ink-2)" }}>Action</th>
                <th className="px-4 py-3 font-medium" style={{ color: "var(--ink-2)" }}>Actor</th>
                <th className="px-4 py-3 font-medium" style={{ color: "var(--ink-2)" }}>Entity</th>
                <th className="px-4 py-3 font-medium" style={{ color: "var(--ink-2)" }}>Date</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--line)" }}>
              {events.map((event) => (
                <tr key={event.id} className="hover:opacity-80">
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: "var(--ink)" }}>
                      {event.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--ink-2)" }}>
                    {event.actor?.name || "System"}
                    <br />
                    <span className="text-xs opacity-70">{event.actor?.email}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--ink-2)" }}>
                    {event.entityType}: {event.entityId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--ink-2)" }}>
                    {format(event.createdAt, "MMM d, yyyy HH:mm")}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--ink-3)" }}>
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
