"use server";

import { requireSession } from "@/lib/session";
import { storeCredential } from "@/server/credential-vault";
import { revalidatePath } from "next/cache";

export async function storeVaultCredentialAction(connectorId: string, payloadStr: string) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Unauthorized");
  
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  let payload: Record<string, string>;
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    return { ok: false, error: "Invalid JSON payload" };
  }

  await storeCredential(organizationId, connectorId, payload);
  
  revalidatePath("/admin/vault");
  return { ok: true };
}
