import type { ProvisionContext } from "./types";
import { withProvisionLifecycle, withRevokeLifecycle } from "@/server/fulfillment";

import { getCredential } from "@/server/credential-vault";

/**
 * Google Workspace connector: adds a user to a Google Group via the
 * Directory API, which triggers downstream app access via IdP group sync.
 *
 * Expected payload fields:
 * - email: user email to add to the group
 * - group_email: the Google Group address (e.g., "eng-team@company.com")
 * - role (optional): "MEMBER" | "MANAGER" | "OWNER" (defaults to "MEMBER")
 */
export async function runGoogleWorkspaceProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ keyB64: string, domain: string, adminEmail: string }>(ctx.organizationId, "google_workspace");
  const keyB64 = creds?.keyB64 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  const domain = creds?.domain || process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  const adminEmail = creds?.adminEmail || process.env.GOOGLE_ADMIN_EMAIL?.trim();

  if (!keyB64 || !domain || !adminEmail) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_WORKSPACE_DOMAIN, and GOOGLE_ADMIN_EMAIL must be set in vault or env for the google_workspace connector",
    );
  }

  const userEmail = (ctx.payload.email as string)?.trim();
  const groupEmail = (ctx.payload.group_email as string)?.trim();
  if (!userEmail || !groupEmail) {
    throw new Error("Payload must include 'email' and 'group_email' for Google Workspace provisioning");
  }

  const role = ((ctx.payload.role as string)?.trim().toUpperCase()) || "MEMBER";

  await withProvisionLifecycle(
    ctx,
    { connector: "google_workspace", userEmail, groupEmail, role, domain },
    async () => {
      const accessToken = await getGoogleAccessToken(keyB64, adminEmail);

      const addRes = await fetch(
        `https://www.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: userEmail,
            role,
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!addRes.ok) {
        const body = await addRes.text().catch(() => "");
        // 409 = already a member — treat as success
        if (addRes.status !== 409) {
          throw new Error(
            `Google Workspace add member failed: HTTP ${addRes.status}${body ? ` — ${body.slice(0, 300)}` : ""}`,
          );
        }
      }
    },
  );
}

/**
 * Revoke Google Workspace access: removes the user from the specified group.
 */
export async function runGoogleWorkspaceRevoke(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ keyB64: string, domain: string, adminEmail: string }>(ctx.organizationId, "google_workspace");
  const keyB64 = creds?.keyB64 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  const domain = creds?.domain || process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  const adminEmail = creds?.adminEmail || process.env.GOOGLE_ADMIN_EMAIL?.trim();

  if (!keyB64 || !domain || !adminEmail) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_WORKSPACE_DOMAIN, and GOOGLE_ADMIN_EMAIL must be set in vault or env for the google_workspace connector",
    );
  }

  const userEmail = (ctx.payload.email as string)?.trim();
  const groupEmail = (ctx.payload.group_email as string)?.trim();
  if (!userEmail || !groupEmail) {
    throw new Error("Payload must include 'email' and 'group_email' for Google Workspace revocation");
  }

  await withRevokeLifecycle(
    ctx,
    { connector: "google_workspace", userEmail, groupEmail, domain },
    async () => {
      const accessToken = await getGoogleAccessToken(keyB64, adminEmail);

      const delRes = await fetch(
        `https://www.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(userEmail)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!delRes.ok && delRes.status !== 404) {
        const body = await delRes.text().catch(() => "");
        throw new Error(
          `Google Workspace delete member failed: HTTP ${delRes.status}${body ? ` — ${body.slice(0, 300)}` : ""}`,
        );
      }
    },
  );
}


/**
 * Obtain a short-lived OAuth2 access token via service account JWT assertion.
 * Uses domain-wide delegation to impersonate the admin.
 */
async function getGoogleAccessToken(keyB64: string, adminEmail: string): Promise<string> {
  const keyJson = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8")) as {
    client_email: string;
    private_key: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: keyJson.client_email,
    sub: adminEmail,
    scope: "https://www.googleapis.com/auth/admin.directory.group.member",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const { createSign } = await import("crypto");

  const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${encHeader}.${encPayload}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(keyJson.private_key, "base64url");

  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${text.slice(0, 300)}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}
