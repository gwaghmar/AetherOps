import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";
import { getCredential } from "@/server/credential-vault";

/**
 * OpenAI connector: invites a user to an organization.
 * 
 * Expected payload fields:
 * - email: the user's email to invite
 * - role: "member" | "owner" (defaults to member)
 */
export async function runOpenAIProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ apiKey: string, orgId: string }>(ctx.organizationId, "openai");
  const apiKey = creds?.apiKey || process.env.OPENAI_API_KEY?.trim();
  const orgId = creds?.orgId || process.env.OPENAI_ORG_ID?.trim();

  if (!apiKey || !orgId) {
    throw new Error("OPENAI_API_KEY and OPENAI_ORG_ID must be set in vault or env for the openai connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for OpenAI provisioning");
  }

  const role = (ctx.payload.role as string)?.trim() || "member";

  await withProvisionLifecycle(
    ctx,
    { connector: "openai", email, role, orgId },
    async () => {
      const response = await fetch(`https://api.openai.com/v1/organizations/${orgId}/invites`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(`OpenAI invite failed: ${JSON.stringify(data)}`);
      }
    }
  );
}

export async function runOpenAIRevoke(_ctx: ProvisionContext): Promise<void> {
  // Revocation requires listing invites or members to find the ID.
}
