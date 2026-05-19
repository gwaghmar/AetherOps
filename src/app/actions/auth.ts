"use server";

import { db } from "@/db";
import { user as userTable, organization as orgTable } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";

export async function ensureUserProfileAction(
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };
  if (!user.email) return { ok: false, error: "Auth user has no email address" };

  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  if (existing.length > 0) return { ok: true };

  const orgId = process.env.DEFAULT_ORGANIZATION_ID?.trim() ?? null;

  // Auto-create the org row if it doesn't exist yet (first deployment / self-serve sign-up)
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
      const orgName =
        process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AetherOps";
      try {
        await db.insert(orgTable).values({ id: orgId, name: orgName, slug });
      } catch (err: unknown) {
        // 23505 = unique_violation — concurrent sign-up already created the org
        if ((err as { code?: string }).code !== "23505") throw err;
      }
    }
  }

  const [row] = await db.select({ n: count() }).from(userTable);
  const isFirst = (row?.n ?? 0) === 0;

  await db.insert(userTable).values({
    id: user.id,
    email: user.email!,
    name: name.trim() || user.email!,
    emailVerified: true,
    role: isFirst ? "admin" : "requester",
    organizationId: orgId,
  });

  return { ok: true };
}
