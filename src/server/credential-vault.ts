import crypto from "node:crypto";
import { db } from "@/db";
import { connectorCredential } from "@/db/app-schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/** 
 * ALGORITHM: AES-256-GCM 
 * Key must be 32 bytes exactly. We use FIELD_ENCRYPTION_KEY if present,
 * or fallback to a deterministic hash of BETTER_AUTH_SECRET if not in prod.
 */
function getEncryptionKey(): Buffer {
  const keyStr = process.env.FIELD_ENCRYPTION_KEY;
  if (keyStr) {
    const buf = Buffer.from(keyStr, "utf-8");
    if (buf.length === 32) return buf;
    if (Buffer.from(keyStr, "base64").length === 32) return Buffer.from(keyStr, "base64");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("FIELD_ENCRYPTION_KEY must be a 32-byte string or base64 in production");
  }

  // Fallback for local development
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret-do-not-use-in-prod";
  return crypto.createHash("sha256").update(fallback).digest();
}

/**
 * Encrypt a plain text string into a structured JSON string containing IV, Auth Tag, and Ciphertext.
 */
export function encryptCredential(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return JSON.stringify({
    iv: iv.toString("base64"),
    data: encrypted,
    tag: authTag,
  });
}

/**
 * Decrypt a structured JSON string back into plaintext.
 */
export function decryptCredential(encryptedData: string): string {
  const key = getEncryptionKey();
  const parsed = JSON.parse(encryptedData) as { iv: string; data: string; tag: string };
  
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  
  let decrypted = decipher.update(parsed.data, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Store or update a connector credential for a specific organization.
 */
export async function storeCredential(
  organizationId: string,
  connectorId: string,
  payload: Record<string, string>
): Promise<void> {
  const encrypted = encryptCredential(JSON.stringify(payload));
  
  const existing = await db.query.connectorCredential.findFirst({
    where: and(
      eq(connectorCredential.organizationId, organizationId),
      eq(connectorCredential.connectorId, connectorId)
    ),
  });

  if (existing) {
    await db
      .update(connectorCredential)
      .set({ encryptedData: encrypted })
      .where(eq(connectorCredential.id, existing.id));
  } else {
    await db.insert(connectorCredential).values({
      id: `cred_${randomUUID().replace(/-/g, "")}`,
      organizationId,
      connectorId,
      encryptedData: encrypted,
    });
  }
}

/**
 * Get and decrypt a connector credential for an organization.
 * Returns null if no credential is found.
 */
export async function getCredential<T extends Record<string, string>>(
  organizationId: string,
  connectorId: string
): Promise<T | null> {
  const existing = await db.query.connectorCredential.findFirst({
    where: and(
      eq(connectorCredential.organizationId, organizationId),
      eq(connectorCredential.connectorId, connectorId)
    ),
  });

  if (!existing) return null;

  try {
    const decrypted = decryptCredential(existing.encryptedData);
    return JSON.parse(decrypted) as T;
  } catch (err) {
    console.error(`Failed to decrypt credential for org ${organizationId}, connector ${connectorId}:`, err);
    return null;
  }
}
