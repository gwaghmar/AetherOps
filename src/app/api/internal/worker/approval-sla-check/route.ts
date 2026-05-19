import { NextResponse } from "next/server";
import { processApprovalSlaEscalations } from "@/server/approval-sla-watcher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processApprovalSlaEscalations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[worker:approval-sla-check] Failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
