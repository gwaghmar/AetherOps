import { NextResponse } from "next/server";
import { processApprovalSlaEscalations } from "@/server/approval-sla-watcher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured", code: "disabled" },
      { status: 503 },
    );
  }
  const authz = req.headers.get("authorization");
  if (authz !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
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
