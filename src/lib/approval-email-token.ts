import { createHmac, randomUUID, timingSafeEqual } from "crypto";

export type EmailApprovalTokenPayload = {
  v: 1;
  jti: string;
  requestId: string;
  approverUserId: string;
  action: "approve" | "deny";
  exp: number;
};

function signingSecret(): string | null {
  const s =
    process.env.APPROVAL_EMAIL_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!s || s.length < 16) return null;
  return s;
}

export function emailApprovalTokensEnabled(): boolean {
  return signingSecret() !== null;
}

export function createEmailApprovalToken(input: {
  requestId: string;
  approverUserId: string;
  action: "approve" | "deny";
  /** Seconds until expiry (default 7 days). */
  ttlSec?: number;
}): string | null {
  const secret = signingSecret();
  if (!secret) return null;

  const ttlSec = input.ttlSec ?? 7 * 24 * 3600;
  const payload: EmailApprovalTokenPayload = {
    v: 1,
    jti: randomUUID(),
    requestId: input.requestId,
    approverUserId: input.approverUserId,
    action: input.action,
    exp: Date.now() + ttlSec * 1000,
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEmailApprovalToken(
  token: string,
):
  | { ok: true; payload: EmailApprovalTokenPayload }
  | { ok: false; error: string } {
  const secret = signingSecret();
  if (!secret) return { ok: false, error: "Email approval tokens are not configured." };

  const i = token.lastIndexOf(".");
  if (i <= 0) return { ok: false, error: "Invalid token format." };
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid signature." };
    }
  } catch {
    return { ok: false, error: "Invalid signature." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid token payload." };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as EmailApprovalTokenPayload).v !== 1
  ) {
    return { ok: false, error: "Unsupported token version." };
  }

  const p = parsed as EmailApprovalTokenPayload;
  if (
    typeof p.jti !== "string" ||
    typeof p.requestId !== "string" ||
    typeof p.approverUserId !== "string" ||
    (p.action !== "approve" && p.action !== "deny") ||
    typeof p.exp !== "number"
  ) {
    return { ok: false, error: "Malformed token." };
  }

  if (Date.now() > p.exp) {
    return { ok: false, error: "This link has expired." };
  }

  return { ok: true, payload: p };
}
