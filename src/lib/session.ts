import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AppRole = "requester" | "approver" | "admin";

export type TypedSession = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: AppRole;
    organizationId: string | null;
    image: string | null;
  };
};

export async function getSession(): Promise<TypedSession | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [profile] = await db
    .select({
      name: userTable.name,
      role: userTable.role,
      organizationId: userTable.organizationId,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  return {
    user: {
      id: user.id,
      email: user.email!,
      name: profile?.name ?? (user.user_metadata?.name as string | null) ?? null,
      role: ((profile?.role ?? "requester") as AppRole),
      organizationId: profile?.organizationId ?? null,
      image: profile?.image ?? null,
    },
  };
}

export async function requireSession(): Promise<TypedSession> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireRole(allowed: AppRole[]): Promise<TypedSession> {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) redirect("/");
  return session;
}
