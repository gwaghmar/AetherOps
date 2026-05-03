"use server";

import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { ssoProvider, scimProvider } from "@/db/auth-schema";
import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function generateScimTokenAction() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Unauthorized");

  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  const token = randomBytes(32).toString("hex");

  // Check if provider exists
  const [existing] = await db.select().from(scimProvider).where(eq(scimProvider.organizationId, organizationId)).limit(1);

  if (existing) {
    await db.update(scimProvider).set({ scimToken: token }).where(eq(scimProvider.id, existing.id));
  } else {
    await db.insert(scimProvider).values({
      id: randomUUID(),
      providerId: `scim_${randomUUID()}`,
      organizationId,
      scimToken: token,
    });
  }

  revalidatePath("/admin/sso");
  return { ok: true, token };
}

export async function saveSamlConfigAction(domain: string, issuer: string, metadataXml: string) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Unauthorized");

  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  const [existing] = await db.select().from(ssoProvider).where(eq(ssoProvider.organizationId, organizationId)).limit(1);

  if (existing) {
    await db.update(ssoProvider).set({
      domain,
      issuer,
      samlConfig: metadataXml,
    }).where(eq(ssoProvider.id, existing.id));
  } else {
    await db.insert(ssoProvider).values({
      id: randomUUID(),
      providerId: `saml_${randomUUID()}`,
      organizationId,
      domain,
      issuer,
      samlConfig: metadataXml,
    });
  }

  revalidatePath("/admin/sso");
  return { ok: true };
}
