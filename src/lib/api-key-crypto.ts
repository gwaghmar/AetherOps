import { createHash, randomBytes } from "crypto";

const PREFIX = "gk";

/**
 * Dedicated pepper for API key hashing.
 * Uses API_KEY_PEPPER if set; falls back to SUPABASE_SERVICE_ROLE_KEY so existing
 * hashes remain valid during migration.  In production, set API_KEY_PEPPER
 * to a separate secret so rotating SUPABASE_SERVICE_ROLE_KEY doesn't invalidate keys.
 */
function pepper() {
  const dedicated = process.env.API_KEY_PEPPER?.trim();
  if (dedicated) return dedicated;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback) return fallback;
  throw new Error("API_KEY_PEPPER (or SUPABASE_SERVICE_ROLE_KEY as fallback) is not set");
}

export function hashApiKey(plaintext: string) {
  return createHash("sha256")
    .update(plaintext)
    .update(pepper())
    .digest("hex");
}

/** Returns { fullKey, lookupId, keyHash } — show fullKey once to the operator. */
export function generateApiKeyMaterial() {
  const lookupId = randomBytes(8).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `${PREFIX}_${lookupId}_${secret}`;
  return {
    fullKey,
    lookupId,
    keyHash: hashApiKey(fullKey),
  };
}

export function parseApiKeyLookupId(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const prefix = `${PREFIX}_`;
  if (!token.startsWith(prefix)) return null;
  const rest = token.slice(prefix.length);
  const sep = rest.indexOf("_");
  if (sep <= 0) return null;
  const lookupId = rest.slice(0, sep);
  return { token, lookupId };
}
