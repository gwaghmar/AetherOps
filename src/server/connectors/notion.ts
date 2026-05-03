import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";

/**
 * Notion connector: Currently Notion public API lacks direct workspace provisioning 
 * outside of SCIM (Enterprise). This connector logs the request or triggers a webhook.
 */
export async function runNotionProvision(ctx: ProvisionContext): Promise<void> {
  const email = (ctx.payload.email as string)?.trim();
  
  await withProvisionLifecycle(
    ctx,
    { connector: "notion", email },
    async () => {
      console.info(`[connector:notion] Manual provisioning required for ${email}. Notion API requires SCIM/Enterprise for automated workspace invites.`);
      // In a real startup, this might trigger a Slack notification to an admin
      // or use a browser automation tool (like Browserless) to click buttons.
    }
  );
}

export async function runNotionRevoke(_ctx: ProvisionContext): Promise<void> {
  console.info(`[connector:notion] Manual revocation required.`);
}
