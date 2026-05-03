import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";
import { getCredential } from "@/server/credential-vault";

/**
 * Linear connector: invites a user to the workspace.
 * 
 * Expected payload fields:
 * - email: the user's email to invite
 * - team_ids: comma-separated list of team IDs to add them to (optional)
 */
export async function runLinearProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ apiKey: string }>(ctx.organizationId, "linear");
  const apiKey = creds?.apiKey || process.env.LINEAR_API_KEY?.trim();
  
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY must be set in vault or env for the linear connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for Linear provisioning");
  }

  const teamIds = (ctx.payload.team_ids as string)?.split(",").map(id => id.trim()).filter(Boolean) || [];

  await withProvisionLifecycle(
    ctx,
    { connector: "linear", email, teamIds },
    async () => {
      const response = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey,
        },
        body: JSON.stringify({
          query: `
            mutation CreateInvite($email: String!, $teamIds: [String!]) {
              organizationInviteCreate(input: { email: $email, teamIds: $teamIds }) {
                success
                organizationInvite {
                  id
                }
              }
            }
          `,
          variables: { email, teamIds },
        }),
      });

      const result = await response.json();
      if (result.errors) {
        // If "Already a member", we treat as success
        const isAlreadyMember = result.errors.some((e: unknown) => 
          e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message.includes("already a member")
        );
        if (!isAlreadyMember) {
          throw new Error(`Linear invite failed: ${JSON.stringify(result.errors)}`);
        }
      }
    }
  );
}

export async function runLinearRevoke(_ctx: ProvisionContext): Promise<void> {
  // Revocation in Linear usually involves suspending the user.
  // This requires the user's ID, which we'd need to lookup first.
  // For MVP, we'll log that manual intervention might be needed or 
  // implement a user lookup + suspension.
}
