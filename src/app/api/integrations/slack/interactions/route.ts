import { NextResponse } from "next/server";
import { verifySlackRequestSignature } from "@/lib/slack-signature";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyRequestDecision } from "@/server/request-decision";

/**
 * Slack Block Kit interactivity entrypoint.
 * Verifies signing secret; processes block actions for request governance.
 */
export async function POST(req: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        error: "SLACK_SIGNING_SECRET is not configured",
        code: "disabled",
      },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");
  if (
    !timestamp ||
    !slackSignature ||
    !verifySlackRequestSignature(
      secret,
      rawBody,
      timestamp,
      slackSignature,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid or missing Slack signature", code: "unauthorized" },
      { status: 401 },
    );
  }

  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    return NextResponse.json({ error: "Ignored event type" }, { status: 200 });
  }

  const action = payload.actions?.[0];
  if (!action || !action.value) {
    return NextResponse.json({ error: "No actionable block found" }, { status: 400 });
  }

  let actionData;
  try {
    actionData = JSON.parse(action.value);
  } catch {
    return NextResponse.json({ error: "Invalid action value" }, { status: 400 });
  }

  const { requestId, organizationId } = actionData;
  if (!requestId || !organizationId) {
    return NextResponse.json({ error: "Missing context in action value" }, { status: 400 });
  }

  const slackUserId = payload.user?.id;
  if (!slackUserId) {
    return NextResponse.json({ error: "Missing Slack user ID" }, { status: 400 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN is not configured" }, { status: 503 });
  }

  // 1. Fetch user email from Slack API
  const slackUserRes = await fetch(
    `https://slack.com/api/users.info?user=${slackUserId}`,
    {
      headers: { Authorization: `Bearer ${botToken}` },
    }
  );
  const slackUserData = await slackUserRes.json();
  if (!slackUserData.ok || !slackUserData.user?.profile?.email) {
    return NextResponse.json({ text: "Error: Could not resolve your Slack email. Please ensure your email is visible." });
  }

  const email = slackUserData.user.profile.email;

  // 2. Lookup platform user by email
  const [platformUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!platformUser) {
    return NextResponse.json({ text: "Error: Your Slack email is not registered in the platform." });
  }

  // 3. Apply decision
  const decision = action.action_id === "approve_request" ? "approved" : "denied";

  try {
    await applyRequestDecision({
      organizationId,
      requestId,
      decision,
      actorUserId: platformUser.id,
      actorRole: "approver",
      comment: "Decided via Slack integration",
    });
  } catch (err) {
    return NextResponse.json({ text: `Error: ${err instanceof Error ? err.message : "Failed to apply decision"}` });
  }

  // 4. Return updated message block
  return NextResponse.json({
    replace_original: true,
    text: `Request ${decision === "approved" ? "Approved ✅" : "Denied ❌"} by <@${slackUserId}>`
  });
}
