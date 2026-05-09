import { requireSession } from "@/lib/session";
import { AuditExportClient } from "./audit-export-client";

export default async function AuditExportPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit export</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          CSV of audit events with joined request metadata for the selected
          window.
        </p>
      </div>
      <AuditExportClient />
    </div>
  );
}
