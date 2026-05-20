import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { organization as orgTable, user as userTable } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId = data.user.id;

      // Ensure a profile row exists for OAuth sign-ins
      const existing = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      if (existing.length === 0) {
        const orgId = process.env.DEFAULT_ORGANIZATION_ID?.trim() ?? null;

        if (orgId) {
          const existingOrg = await db
            .select({ id: orgTable.id })
            .from(orgTable)
            .where(eq(orgTable.id, orgId))
            .limit(1);
          if (existingOrg.length === 0) {
            const slug =
              process.env.DEFAULT_ORGANIZATION_SLUG?.trim() ||
              orgId.replace(/^org_/, "").toLowerCase();
            const orgName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AetherOps";
            try {
              await db.insert(orgTable).values({ id: orgId, name: orgName, slug });
            } catch (err: unknown) {
              if ((err as { code?: string }).code !== "23505") throw err;
            }
          }
        }

        const [row] = await db.select({ n: count() }).from(userTable);
        const isFirst = Number(row?.n ?? 0) === 0;

        await db.insert(userTable).values({
          id: userId,
          email: data.user.email!,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            (data.user.user_metadata?.name as string | undefined) ??
            data.user.email!,
          emailVerified: true,
          role: isFirst ? "admin" : "requester",
          organizationId: orgId,
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
