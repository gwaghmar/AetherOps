import { getSession, type AppRole } from "@/lib/session";
import { assertAuditExportRangeOrThrow } from "@/lib/audit-export-limit";
import { queryAuditExportRows } from "@/server/audit-export";

export const runtime = "nodejs";

function csvEscape(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const role = (session.user.role ?? "requester") as AppRole;
  if (role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return new Response("User has no organization", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (!fromStr || !toStr) {
    return new Response("Missing from or to (ISO dates)", { status: 400 });
  }
  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return new Response("Invalid date range", { status: 400 });
  }

  try {
    assertAuditExportRangeOrThrow(from, to);
  } catch {
    return new Response("Invalid or excessive date range", { status: 400 });
  }

  const rows = await queryAuditExportRows({ orgId, from, to });

  const header = [
    "audit_id",
    "created_at",
    "action",
    "entity_type",
    "entity_id",
    "actor_id",
    "request_status",
    "request_type_title",
    "requester_email",
    "change_ticket_title",
    "change_ticket_stage",
    "change_template_title",
    "change_assignee_email",
    "metadata_json",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.auditId,
        r.createdAt?.toISOString() ?? "",
        r.action,
        r.entityType,
        r.entityId,
        r.actorId ?? "",
        r.requestStatus ?? "",
        r.requestTypeTitle ?? "",
        r.requesterEmail ?? "",
        r.changeTicketTitle ?? "",
        r.changeTicketStage ?? "",
        r.changeTemplateTitle ?? "",
        r.changeAssigneeEmail ?? "",
        r.metadata ? JSON.stringify(r.metadata) : "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const csv = lines.join("\r\n");
  const filename = `audit-export_${fromStr.slice(0, 10)}_${toStr.slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
