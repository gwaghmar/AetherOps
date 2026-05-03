import { IAMClient, AddUserToGroupCommand, RemoveUserFromGroupCommand, GetUserCommand } from "@aws-sdk/client-iam";
import type { ProvisionContext } from "./types";
import { withProvisionLifecycle, withRevokeLifecycle } from "@/server/fulfillment";

import { getCredential } from "@/server/credential-vault";

/**
 * AWS IAM connector: adds/removes users from groups.
 * 
 * Expected payload fields:
 * - iam_username: the IAM username
 * - group_name: the IAM group to add/remove from
 */
export async function runAwsProvision(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ accessKeyId: string, secretAccessKey: string, region?: string }>(ctx.organizationId, "aws");
  const region = creds?.region || process.env.AWS_REGION || "us-east-1";
  const accessKeyId = creds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = creds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in vault or env for the aws connector");
  }

  const username = (ctx.payload.iam_username as string)?.trim();
  const groupName = (ctx.payload.group_name as string)?.trim();

  if (!username || !groupName) {
    throw new Error("Payload must include 'iam_username' and 'group_name' for AWS provisioning");
  }

  const client = new IAMClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  await withProvisionLifecycle(
    ctx,
    { connector: "aws", region, username, groupName },
    async () => {
      // Step 1: Ensure user exists (optional, but good for robust connectors)
      try {
        await client.send(new GetUserCommand({ UserName: username }));
      } catch (err: unknown) {
        if (err && typeof err === "object" && "name" in err && err.name === "NoSuchEntity") {
          // If the policy allows, we could create the user, but usually we just want to manage groups
          throw new Error(`AWS user ${username} does not exist. Cannot add to group.`);
        }
        throw err;
      }

      // Step 2: Add user to group
      await client.send(new AddUserToGroupCommand({
        UserName: username,
        GroupName: groupName,
      }));
    }
  );
}

export async function runAwsRevoke(ctx: ProvisionContext): Promise<void> {
  const creds = await getCredential<{ accessKeyId: string, secretAccessKey: string, region?: string }>(ctx.organizationId, "aws");
  const region = creds?.region || process.env.AWS_REGION || "us-east-1";
  const accessKeyId = creds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = creds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in vault or env for the aws connector");
  }

  const username = (ctx.payload.iam_username as string)?.trim();
  const groupName = (ctx.payload.group_name as string)?.trim();

  if (!username || !groupName) {
    throw new Error("Payload must include 'iam_username' and 'group_name' for AWS revocation");
  }

  const client = new IAMClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  await withRevokeLifecycle(
    ctx,
    { connector: "aws", region, username, groupName },
    async () => {
      try {
        await client.send(new RemoveUserFromGroupCommand({
          UserName: username,
          GroupName: groupName,
        }));
      } catch (err: unknown) {
        if (err && typeof err === "object" && "name" in err && err.name === "NoSuchEntity") {
          // If user or group doesn't exist, revocation is effectively complete
          return;
        }
        throw err;
      }
    }
  );
}
