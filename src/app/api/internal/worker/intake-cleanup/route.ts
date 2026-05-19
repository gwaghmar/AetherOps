import { NextResponse } from "next/server";
import { expireStaleConversations } from "@/server/intake/conversation-store";

export const runtime = "nodejs";
export const maxDuration = 30;

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
    const expired = await expireStaleConversations();
    return NextResponse.json({ ok: true, expired });
  } catch (err) {
    console.error("[worker:intake-cleanup] Failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
