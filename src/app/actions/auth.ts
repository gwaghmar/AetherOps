"use server";

import { db } from "@/db";
import { user as userTable } from "@/db/schema";
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

  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  if (existing.length > 0) return { ok: true };

  const [row] = await db.select({ n: count() }).from(userTable);
  const isFirst = (row?.n ?? 0) === 0;

  await db.insert(userTable).values({
    id: user.id,
    email: user.email!,
    name: name.trim() || user.email!,
    emailVerified: true,
    role: isFirst ? "admin" : "requester",
    organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() ?? null,
  });

  return { ok: true };
}
