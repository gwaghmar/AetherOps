import { z } from "zod";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Validates required production configuration. Call from instrumentation on boot.
 * In development/test, missing optional values use safe local defaults elsewhere.
 */
export function assertProductionEnv(): void {
  if (!isProduction()) return;

  const base = z.object({
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters (use openssl rand -base64 32)"),
    BETTER_AUTH_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  });

  const parsed = base.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`[env] Production misconfiguration: ${msg}`);
  }

  if (/sslmode=no-verify/i.test(parsed.data.DATABASE_URL)) {
    throw new Error(
      "[env] DATABASE_URL must not use sslmode=no-verify in production. Use sslmode=require or verify-full with a proper trust store.",
    );
  }

  const hasOrg =
    Boolean(process.env.DEFAULT_ORGANIZATION_ID?.trim()) ||
    Boolean(process.env.DEFAULT_ORGANIZATION_SLUG?.trim());
  if (!hasOrg) {
    throw new Error(
      "[env] Set DEFAULT_ORGANIZATION_ID or DEFAULT_ORGANIZATION_SLUG in production so new users join the correct tenant.",
    );
  }

  const connector = process.env.PROVISION_CONNECTOR?.trim() || "stub";
  if (connector === "stub" && process.env.ALLOW_STUB_PROVISION !== "true") {
    throw new Error(
      "[env] PROVISION_CONNECTOR=stub is not allowed in production unless ALLOW_STUB_PROVISION=true (for staging only). Use http_webhook or another real connector.",
    );
  }

  if (connector === "http_webhook") {
    const url = process.env.PROVISION_WEBHOOK_URL?.trim();
    if (!url) {
      throw new Error(
        "[env] PROVISION_WEBHOOK_URL is required when PROVISION_CONNECTOR=http_webhook",
      );
    }
    try {
      new URL(url);
    } catch {
      throw new Error("[env] PROVISION_WEBHOOK_URL must be a valid URL");
    }
  }

  const keyB64 = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!keyB64) {
    throw new Error(
      "[env] FIELD_ENCRYPTION_KEY is required in production to protect stored secrets.",
    );
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "[env] FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).",
    );
  }

  if (!process.env.API_KEY_PEPPER?.trim()) {
    console.warn(
      "[env] API_KEY_PEPPER is not set. Falling back to BETTER_AUTH_SECRET for API key hashing. " +
      "Set API_KEY_PEPPER to a dedicated secret so rotating BETTER_AUTH_SECRET does not invalidate API keys.",
    );
  }
}

function addLocalLoopbackAliases(origins: Set<string>): void {
  if (isProduction()) return;
  const extras: string[] = [];
  for (const o of origins) {
    try {
      const u = new URL(o);
      if (u.hostname === "localhost") {
        u.hostname = "127.0.0.1";
        extras.push(u.origin);
      } else if (u.hostname === "127.0.0.1") {
        u.hostname = "localhost";
        extras.push(u.origin);
      }
    } catch {
      // ignore invalid URLs
    }
  }
  for (const e of extras) origins.add(e);
}

/**
 * Trusted origins for Better Auth (CSRF / callbacks). Non-production falls back to localhost.
 */
export function getTrustedAuthOrigins(): string[] {
  const set = new Set(
    [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
      (u): u is string => Boolean(u?.trim()),
    ),
  );
  addLocalLoopbackAliases(set);
  const list = [...set];
  if (list.length > 0) return list;
  if (isProduction()) {
    throw new Error(
      "BETTER_AUTH_URL and/or NEXT_PUBLIC_APP_URL must be set in production",
    );
  }
  return ["http://localhost:3000"];
}

/** Public site URL for server-side auth client base URL fallback. */
export function getPublicAppUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u) return u;
  if (isProduction()) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }
  return "http://localhost:3000";
}

/**
 * Display name for UI (optional). Defaults to "AI Governance".
 */
export function getPublicAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "GrantOps";
}
