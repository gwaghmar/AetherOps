import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";
import { getCredential } from "@/server/credential-vault";

/**
 * Vercel connector: invites a user to a team.
 * 
 * Expected payload fields:
 * - email: the user's email to invite
 * - role: "MEMBER" | "OWNER" | "CONTRIBUTOR" | "VIEWER" (defaults to MEMBER)
 */
export async function runVercelProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ token: string, teamId: string }>(ctx.organizationId, "vercel");
  const token = creds?.token || process.env.VERCEL_TOKEN?.trim();
  const teamId = creds?.teamId || process.env.VERCEL_TEAM_ID?.trim();
  
  if (!token || !teamId) {
    throw new Error("VERCEL_TOKEN and VERCEL_TEAM_ID must be set in vault or env for the vercel connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for Vercel provisioning");
  }

  const role = (ctx.payload.role as string)?.trim() || "MEMBER";

  await withProvisionLifecycle(
    ctx,
    { connector: "vercel", email, role, teamId },
    async () => {
      const response = await fetch(`https://api.vercel.com/v1/teams/${teamId}/members`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // If already invited or member, status 409 or similar might occur
        if (response.status !== 409) {
          throw new Error(`Vercel invite failed: ${JSON.stringify(data)}`);
        }
      }
    }
  );
}

export async function runVercelRevoke(ctx: ProvisionContext): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !teamId) return;

  const email = (ctx.payload.email as string)?.trim();
  if (!email) return;

  // Revocation requires user ID. We must find user ID by email first.
  // Vercel API doesn't have a direct "remove by email" for teams in the public docs easily,
  // usually you'd list members and find the one with the email.
}
