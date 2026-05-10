import { getSession } from "@/lib/session";
import { assertAuditExportRangeOrThrow } from "@/lib/audit-export-limit";
import { buildAuditEvidencePdf } from "@/server/audit-pdf";
import { queryAuditExportRows } from "@/server/audit-export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const role = session.user.role ?? "requester";
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
  const pdf = await buildAuditEvidencePdf(rows);
  const filename = `audit-evidence_${fromStr.slice(0, 10)}_${toStr.slice(0, 10)}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
