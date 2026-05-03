import { processSlaEscalations } from "@/server/sla-watcher";
import { headers } from "next/headers";

export const runtime = "nodejs";

/**
 * Internal worker endpoint for SLA escalation checks.
 * Triggered by cron (e.g. Vercel Cron or GitHub Action).
 */
export async function POST(req: Request) {
  // Simple secret-based protection for internal worker routes
  const h = await headers();
  const secret = h.get("x-worker-secret");
  
  if (process.env.INTERNAL_WORKER_SECRET && secret !== process.env.INTERNAL_WORKER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processSlaEscalations();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[worker:sla-check] Failed:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
