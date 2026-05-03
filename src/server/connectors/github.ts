import type { ProvisionContext } from "./types";
import { withProvisionLifecycle, withRevokeLifecycle } from "@/server/fulfillment";

import { getCredential } from "@/server/credential-vault";

/**
 * GitHub connector: invites a user to an org/team via the GitHub REST API.
 *
 * Expected payload fields from the request:
 * - email: the user's email for the org invite
 * - team_slug (optional): team to add the user to after invite
 * - role (optional): "member" | "admin" (defaults to "member")
 */
export async function runGitHubProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ org: string, pat: string }>(ctx.organizationId, "github");
  const org = creds?.org || process.env.GITHUB_ORG?.trim();
  const pat = creds?.pat || process.env.GITHUB_PAT?.trim();

  if (!org || !pat) {
    throw new Error("GITHUB_ORG and GITHUB_PAT must be set in vault or env for the github connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for GitHub provisioning");
  }

  const role = (ctx.payload.role as string)?.trim() || "member";
  const teamSlug = (ctx.payload.team_slug as string)?.trim() || null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  await withProvisionLifecycle(
    ctx,
    { connector: "github", org, email, role, teamSlug },
    async () => {
      // Step 1: Create org invitation
      const inviteRes = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(org)}/invitations`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ email, role }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!inviteRes.ok) {
        const body = await inviteRes.text().catch(() => "");
        // 422 = already a member — treat as success
        if (inviteRes.status !== 422) {
          throw new Error(
            `GitHub invite failed: HTTP ${inviteRes.status}${body ? ` — ${body.slice(0, 300)}` : ""}`,
          );
        }
      }

      // Step 2: Add to team if specified
      if (teamSlug) {
        // We need the username — resolve from email via search
        const searchRes = await fetch(
          `https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`,
          { headers, signal: AbortSignal.timeout(15_000) },
        );
        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as { items?: { login: string }[] };
          const username = searchData.items?.[0]?.login;
          if (username) {
            await fetch(
              `https://api.github.com/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(teamSlug)}/memberships/${encodeURIComponent(username)}`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify({ role: "member" }),
                signal: AbortSignal.timeout(15_000),
              },
            );
          }
        }
      }
    },
  );
}

/**
 * Revoke GitHub access: removes the user from the organization entirely.
 */
export async function runGitHubRevoke(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ org: string, pat: string }>(ctx.organizationId, "github");
  const org = creds?.org || process.env.GITHUB_ORG?.trim();
  const pat = creds?.pat || process.env.GITHUB_PAT?.trim();

  if (!org || !pat) {
    throw new Error("GITHUB_ORG and GITHUB_PAT must be set in vault or env for the github connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for GitHub revocation");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  await withRevokeLifecycle(
    ctx,
    { connector: "github", org, email },
    async () => {
      // We need the username to remove from org
      const searchRes = await fetch(
        `https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`,
        { headers, signal: AbortSignal.timeout(15_000) },
      );
      if (!searchRes.ok) {
        throw new Error(`GitHub search for ${email} failed: HTTP ${searchRes.status}`);
      }

      const searchData = (await searchRes.json()) as { items?: { login: string }[] };
      const username = searchData.items?.[0]?.login;

      if (!username) {
        // User not found in GitHub — consider revoked / never joined
        return;
      }

      const revokeRes = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(username)}`,
        {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!revokeRes.ok && revokeRes.status !== 404) {
        const body = await revokeRes.text().catch(() => "");
        throw new Error(
          `GitHub revoke failed for ${username}: HTTP ${revokeRes.status}${body ? ` — ${body.slice(0, 300)}` : ""}`,
        );
      }
    },
  );
}

