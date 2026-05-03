import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";

import { getCredential } from "@/server/credential-vault";

/**
 * Slack connector: invites a user to a channel.
 * 
 * Expected payload fields:
 * - email: the user's email to lookup their Slack ID
 * - channel_id: the Slack channel ID to invite them to
 */
export async function runSlackProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ botToken: string }>(ctx.organizationId, "slack");
  const token = creds?.botToken || process.env.SLACK_BOT_TOKEN?.trim();
  
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN must be set in vault or env for the slack connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  const channelId = (ctx.payload.channel_id as string)?.trim();

  if (!email || !channelId) {
    throw new Error("Payload must include 'email' and 'channel_id' for Slack provisioning");
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };

  await withProvisionLifecycle(
    ctx,
    { connector: "slack", channelId, email },
    async () => {
      // Step 1: Lookup user ID by email
      const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
        headers,
      });
      const lookupData = await lookupRes.json();
      
      if (!lookupData.ok) {
        throw new Error(`Slack user lookup failed: ${lookupData.error}`);
      }

      const userId = lookupData.user.id;

      // Step 2: Invite user to channel
      const inviteRes = await fetch("https://slack.com/api/conversations.invite", {
        method: "POST",
        headers,
        body: JSON.stringify({
          channel: channelId,
          users: userId,
        }),
      });
      
      const inviteData = await inviteRes.json();
      
      if (!inviteData.ok) {
        // "already_in_channel" is a success for us
        if (inviteData.error === "already_in_channel") {
          return;
        }
        throw new Error(`Slack invite failed: ${inviteData.error}`);
      }
    }
  );
}

export async function runSlackRevoke(ctx: ProvisionContext): Promise<void> {
  // Slack revocation (kicking from channel) is often considered harsh for standard workflows,
  // but we can implement it if needed using `conversations.kick`.
  const creds = await getCredential<{ botToken: string }>(ctx.organizationId, "slack");
  const token = creds?.botToken || process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return;

  const email = (ctx.payload.email as string)?.trim();
  const channelId = (ctx.payload.channel_id as string)?.trim();
  if (!email || !channelId) return;

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };

  // Step 1: Lookup user ID
  const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers,
  });
  const lookupData = await lookupRes.json();
  if (!lookupData.ok) return;

  const userId = lookupData.user.id;

  // Step 2: Kick from channel
  await fetch("https://slack.com/api/conversations.kick", {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: channelId,
      user: userId,
    }),
  });
}
