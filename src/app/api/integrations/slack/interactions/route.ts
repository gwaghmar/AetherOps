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

  const slackUserId = payload.user?.id;
  if (!slackUserId) {
    return NextResponse.json({ error: "Missing Slack user ID" }, { status: 400 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN is not configured" }, { status: 503 });
  }

  // Intake confirmation actions
  if (action.action_id === "confirm_intake" || action.action_id === "cancel_intake") {
    let actionData: { conversationId?: string } = {};
    try {
      actionData = JSON.parse(action.value ?? "{}");
    } catch {
      return NextResponse.json({ text: "Error: Invalid action data." });
    }

    const { conversationId } = actionData;
    if (!conversationId) {
      return NextResponse.json({ text: "Error: Missing conversation ID." });
    }

    const { intakeConversation: intakeConvTable } = await import("@/db/schema");
    const { sendDM: slackSendDM } = await import("@/server/intake/channels/slack");
    const { eq: eqDyn, and: andDyn } = await import("drizzle-orm");

    const [conv] = await db
      .select()
      .from(intakeConvTable)
      .where(eqDyn(intakeConvTable.id, conversationId))
      .limit(1);

    if (!conv || conv.state !== "awaiting_confirmation") {
      return NextResponse.json({
        replace_original: true,
        text: "This request has already been handled or expired.",
      });
    }

    // Verify the clicker is the user who started this conversation
    if (slackUserId !== conv.channelUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Atomic CAS: only the first of any concurrent duplicate requests wins
    const claimed = await db
      .update(intakeConvTable)
      .set({ state: "resolved", updatedAt: new Date() })
      .where(
        andDyn(
          eqDyn(intakeConvTable.id, conversationId),
          eqDyn(intakeConvTable.state, "awaiting_confirmation"),
        ),
      )
      .returning({ id: intakeConvTable.id });

    if (claimed.length === 0) {
      return NextResponse.json({
        replace_original: true,
        text: "This request has already been handled or expired.",
      });
    }

    if (action.action_id === "cancel_intake") {
      await slackSendDM(botToken, slackUserId, "Request cancelled. Let me know if you need anything else.");
      return NextResponse.json({ replace_original: true, text: "Request cancelled." });
    }

    // confirm_intake: create the request
    if (!conv.detectedRequestTypeSlug || !conv.resolvedUserId) {
      await slackSendDM(botToken, slackUserId, "Sorry, I lost the request details. Please try submitting again.");
      return NextResponse.json({ replace_original: true, text: "Could not submit — missing data." });
    }

    const { findRequestTypeBySlug, createRequestCore } = await import("@/server/create-request");
    const { buildPayloadSchema, parseFieldSchema } = await import("@/lib/request-schemas");

    const type = await findRequestTypeBySlug(conv.organizationId, conv.detectedRequestTypeSlug);
    if (!type) {
      await slackSendDM(botToken, slackUserId, "That request type no longer exists. Please try again.");
      return NextResponse.json({ replace_original: true, text: "Request type not found." });
    }

    const fieldSchema = parseFieldSchema(type.fieldSchema);
    const payloadCheck = buildPayloadSchema(fieldSchema.fields).safeParse(conv.detectedPayload ?? {});
    if (!payloadCheck.success) {
      await slackSendDM(botToken, slackUserId, "Some required fields are missing. Please try again with more details.");
      return NextResponse.json({ replace_original: true, text: "Payload validation failed." });
    }

    try {
      const result = await createRequestCore({
        organizationId: conv.organizationId,
        requesterId: conv.resolvedUserId,
        requestTypeId: type.id,
        payload: payloadCheck.data as Record<string, unknown>,
        typeSlug: type.slug,
        typeTitle: type.title,
        typeRiskDefaults: type.riskDefaults,
        slaHours: type.slaHours ?? null,
        auditAction: "request_created_slack_intake",
        auditActorId: conv.resolvedUserId,
        auditMetadata: { ingest: "slack", conversationId },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
      await slackSendDM(
        botToken,
        slackUserId,
        `Request submitted! Track it at ${appUrl}/requests/${result.id}`,
      );

      return NextResponse.json({
        replace_original: true,
        text: `Request submitted ✓ — ID ${result.id}`,
      });
    } catch (err) {
      console.error("[slack:confirm_intake] createRequestCore failed:", err);
      await slackSendDM(botToken, slackUserId, "Failed to submit your request. Please try again or contact support.");
      return NextResponse.json({ replace_original: true, text: "Submission failed." });
    }
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

  if (platformUser.organizationId !== organizationId) {
    return NextResponse.json({ text: "Error: You are not authorized to act on this request." });
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
