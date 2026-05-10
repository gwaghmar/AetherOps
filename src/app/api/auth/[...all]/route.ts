import { NextResponse } from "next/server";

// Better Auth has been replaced by Supabase Auth.
// Auth is handled by @supabase/ssr + middleware.ts.
// OAuth callbacks go to /api/auth/callback.
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export const POST = GET;
