import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, user as userTable } from "@/db/schema";
import { verifySlackRequestSignature } from "@/lib/slack-signature";
import { runIntentEngine } from "@/server/intake/intent-engine";
import {
  getOpenConversation,
  createConversation,
  updateConversation,
} from "@/server/intake/conversation-store";
import {
  sendClarification,
  sendConfirmationCard,
  sendDM,
  resolveSlackUser,
} from "@/server/intake/channels/slack";

export const runtime = "nodejs";

const MAX_TURNS = 3;

export async function POST(req: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Slack not configured", code: "disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");

  if (
    !timestamp ||
    !slackSignature ||
    !verifySlackRequestSignature(secret, rawBody, timestamp, slackSignature)
  ) {
    return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond to Slack URL verification immediately
  if (event.type === "url_verification") {
    return NextResponse.json({ challenge: event.challenge });
  }

  // Return 200 immediately — process async
  const innerEvent = event.event as Record<string, unknown> | undefined;
  if (!innerEvent) return NextResponse.json({ ok: true });

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    console.error("[slack-events] SLACK_BOT_TOKEN not set");
    return NextResponse.json({ ok: true });
  }

  // Only handle DM messages (not from bots)
  const isDM = innerEvent.type === "message" && innerEvent.channel_type === "im";
  const isMention = innerEvent.type === "app_mention";
  if (!isDM && !isMention) return NextResponse.json({ ok: true });

  // Ignore bot messages to avoid loops
  if (innerEvent.bot_id || innerEvent.subtype) return NextResponse.json({ ok: true });

  const slackUserId = innerEvent.user as string | undefined;
  const text = (innerEvent.text as string | undefined)?.trim() ?? "";
  const threadTs = (innerEvent.ts as string | undefined) ?? null;
  const teamId = event.team_id as string | undefined;

  if (!slackUserId || !text || !teamId) return NextResponse.json({ ok: true });

  // Run async so Slack gets its 200 response under 3s
  void processSlackMessage({ botToken, slackUserId, text, threadTs, teamId });

  return NextResponse.json({ ok: true });
}

async function processSlackMessage(input: {
  botToken: string;
  slackUserId: string;
  text: string;
  threadTs: string | null;
  teamId: string;
}) {
  const { botToken, slackUserId, text, threadTs, teamId } = input;

  try {
    // Resolve org from Slack team ID
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slackTeamId, teamId))
      .limit(1);

    if (!org) {
      await sendDM(
        botToken,
        slackUserId,
        "I don't recognize this Slack workspace. Please contact your IT admin.",
      );
      return;
    }

    // Resolve platform user from Slack user email
    const slackUser = await resolveSlackUser(botToken, slackUserId);
    if (!slackUser) {
      await sendDM(
        botToken,
        slackUserId,
        "I couldn't retrieve your email from Slack. Make sure your email is visible in your profile.",
      );
      return;
    }

    const [platformUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, slackUser.email))
      .limit(1);

    if (!platformUser) {
      await sendDM(
        botToken,
        slackUserId,
        `I don't recognize your account. Sign up at ${process.env.NEXT_PUBLIC_APP_URL} first.`,
      );
      return;
    }

    // Check for an open conversation
    const existing = await getOpenConversation("slack", slackUserId);

    if (existing) {
      const newTurnCount = existing.turnCount + 1;

      if (newTurnCount >= MAX_TURNS) {
        await updateConversation(existing.id, { state: "expired" });
        await sendDM(
          botToken,
          slackUserId,
          `I'm having trouble understanding your request. Try submitting directly at ${process.env.NEXT_PUBLIC_APP_URL}/requests/new`,
        );
        return;
      }

      // Continue conversation with the new message
      await updateConversation(existing.id, { turnCount: newTurnCount });
      const result = await runIntentEngine(org.id, text);

      if (result.confidence === "high" && result.slug) {
        await updateConversation(existing.id, {
          state: "awaiting_confirmation",
          detectedRequestTypeSlug: result.slug,
          detectedPayload: result.payload,
        });
        await sendConfirmationCard(botToken, slackUserId, threadTs, {
          conversationId: existing.id,
          requestTypeTitle: result.slug,
          payload: result.payload,
        });
      } else {
        await sendClarification(
          botToken,
          slackUserId,
          result.clarificationQuestion ?? "Could you be more specific about what you need?",
          threadTs,
        );
      }
      return;
    }

    // New conversation
    const result = await runIntentEngine(org.id, text);

    if (result.confidence === "high" && result.slug) {
      const conv = await createConversation({
        organizationId: org.id,
        channel: "slack",
        channelUserId: slackUserId,
        channelThreadId: threadTs,
        resolvedUserId: platformUser.id,
        state: "awaiting_confirmation",
        detectedRequestTypeSlug: result.slug,
        detectedPayload: result.payload,
        turnCount: 1,
      });
      await sendConfirmationCard(botToken, slackUserId, threadTs, {
        conversationId: conv.id,
        requestTypeTitle: result.slug,
        payload: result.payload,
      });
    } else {
      await createConversation({
        organizationId: org.id,
        channel: "slack",
        channelUserId: slackUserId,
        channelThreadId: threadTs,
        resolvedUserId: platformUser.id,
        state: "awaiting_clarification",
        turnCount: 1,
      });
      await sendClarification(
        botToken,
        slackUserId,
        result.clarificationQuestion ?? "What do you need help with?",
        threadTs,
      );
    }
  } catch (err) {
    console.error("[slack-events] processSlackMessage error:", err);
  }
}
