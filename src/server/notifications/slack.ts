import { getCredential } from "@/server/credential-vault";

export async function sendSlackApprovalMessage(input: {
  organizationId: string;
  requestId: string;
  requestTitle: string;
  requesterName: string;
  requesterEmail: string;
  managerEmail: string;
  reviewUrl: string;
  payloadSummary: string;
}) {
  const creds = await getCredential<{ botToken: string }>(input.organizationId, "slack");
  const token = creds?.botToken || process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return; // Slack not configured

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };

  // Lookup manager by email
  const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(input.managerEmail)}`, { headers });
  const lookupData = await lookupRes.json();
  if (!lookupData.ok) return; // Manager not found in Slack

  const managerSlackId = lookupData.user.id;

  const blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "New Request Requires Approval",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": `*Request Type:*\n${input.requestTitle}`
        },
        {
          "type": "mrkdwn",
          "text": `*Requester:*\n${input.requesterName} (<mailto:${input.requesterEmail}|${input.requesterEmail}>)`
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Details:*\n${input.payloadSummary}`
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Approve",
            "emoji": true
          },
          "style": "primary",
          "value": JSON.stringify({ requestId: input.requestId, organizationId: input.organizationId }),
          "action_id": "approve_request"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Deny",
            "emoji": true
          },
          "style": "danger",
          "value": JSON.stringify({ requestId: input.requestId, organizationId: input.organizationId }),
          "action_id": "deny_request"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Details",
            "emoji": true
          },
          "url": input.reviewUrl,
          "action_id": "view_request"
        }
      ]
    }
  ];

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: managerSlackId,
      blocks,
      text: `New Request from ${input.requesterName} requires approval: ${input.requestTitle}`
    }),
  });
}
