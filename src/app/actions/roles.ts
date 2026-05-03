"use server";

import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { roleBundle, roleBundleRequestType } from "@/db/schema";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { applyRoleBundle as applyBundleLogic } from "@/server/jml-orchestrator";
import { eq } from "drizzle-orm";

export async function createRoleBundleAction(name: string, description?: string) {
  const session = await requireRole(["admin"]);
  const id = randomUUID();
  await db.insert(roleBundle).values({
    id,
    organizationId: session.user.organizationId!,
    name,
    description,
  });
  revalidatePath("/admin/roles");
  return { id };
}

export async function deleteRoleBundleAction(id: string) {
  const session = await requireRole(["admin"]);
  await db.delete(roleBundle).where(eq(roleBundle.id, id));
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function addTypeToBundleAction(bundleId: string, requestTypeId: string, overrides: Record<string, unknown> = {}) {
  await requireRole(["admin"]);
  await db.insert(roleBundleRequestType).values({
    id: randomUUID(),
    roleBundleId: bundleId,
    requestTypeId,
    payloadOverrides: overrides,
  });
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function applyBundleToUserAction(userId: string, bundleId: string) {
  const session = await requireRole(["admin"]);
  const results = await applyBundleLogic(userId, bundleId, session.user.id);
  // Revalidate relevant paths
  revalidatePath("/admin/roles");
  revalidatePath("/requests");
  return results;
}

export async function offboardUserAction(userId: string) {
  const session = await requireRole(["admin"]);
  const { offboardUser } = await import("@/server/jml-orchestrator");
  const results = await offboardUser(userId, session.user.organizationId!, session.user.id);
  revalidatePath("/admin/users");
  revalidatePath("/analytics/ai");
  return results;
}
