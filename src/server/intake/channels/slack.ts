type SlackBlock = Record<string, unknown>;

const SLACK_API = "https://slack.com/api";

async function slackPost(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; channel?: string; ts?: string; error?: string }>;
}

export async function openDMChannel(token: string, slackUserId: string): Promise<string> {
  const data = await slackPost(token, "conversations.open", { users: slackUserId });
  if (!data.ok || !data.channel) {
    throw new Error(`conversations.open failed: ${data.error ?? "unknown"}`);
  }
  return data.channel;
}

export async function sendDM(
  token: string,
  slackUserId: string,
  text: string,
): Promise<string | null> {
  const channel = await openDMChannel(token, slackUserId);
  const data = await slackPost(token, "chat.postMessage", { channel, text });
  return data.ts ?? null;
}

export async function sendClarification(
  token: string,
  slackUserId: string,
  question: string,
  threadTs: string | null,
): Promise<void> {
  const channel = await openDMChannel(token, slackUserId);
  await slackPost(token, "chat.postMessage", {
    channel,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: question,
  });
}

export async function sendConfirmationCard(
  token: string,
  slackUserId: string,
  threadTs: string | null,
  intent: {
    conversationId: string;
    requestTypeTitle: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const channel = await openDMChannel(token, slackUserId);
  const payloadSummary = Object.entries(intent.payload)
    .map(([k, v]) => `• *${k}:* ${String(v)}`)
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${intent.requestTypeTitle}*\n${payloadSummary || "_No details extracted._"}`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Review and confirm — this will create a tracked request." }],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Submit Request" },
          action_id: "confirm_intake",
          style: "primary",
          value: JSON.stringify({ conversationId: intent.conversationId }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cancel" },
          action_id: "cancel_intake",
          value: JSON.stringify({ conversationId: intent.conversationId }),
        },
      ],
    },
  ];

  await slackPost(token, "chat.postMessage", {
    channel,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: `Confirm: ${intent.requestTypeTitle}`,
    blocks,
  });
}

export async function resolveSlackUser(
  token: string,
  slackUserId: string,
): Promise<{ email: string } | null> {
  const data = await fetch(`${SLACK_API}/users.info?user=${slackUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json()) as { ok: boolean; user?: { profile?: { email?: string } } };

  const email = data.user?.profile?.email;
  return email ? { email } : null;
}
