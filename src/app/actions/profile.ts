"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { requireSession } from "@/lib/session";

export async function updateProfileName(name: string) {
  const parsed = z.string().min(1).max(200).safeParse(name);
  if (!parsed.success) throw new Error("Invalid name");

  const session = await requireSession();
  await db
    .update(userTable)
    .set({ name: parsed.data })
    .where(eq(userTable.id, session.user.id));

  revalidatePath("/profile");
}
