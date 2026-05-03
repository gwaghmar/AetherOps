import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/integrations/slack/interactions/route";

// Mock dependencies
vi.mock("@/lib/slack-signature", () => ({
  verifySlackRequestSignature: vi.fn(() => true),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "usr_123", email: "manager@example.com" }]),
  },
}));

vi.mock("@/server/request-decision", () => ({
  applyRequestDecision: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch for Slack API
global.fetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue({
    ok: true,
    user: { profile: { email: "manager@example.com" } },
  }),
});

describe("Slack Interactivity Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_SIGNING_SECRET = "secret";
    process.env.SLACK_BOT_TOKEN = "xoxb-bot-token";
  });

  it("processes an approve_request block action", async () => {
    const payload = {
      type: "block_actions",
      user: { id: "U12345" },
      actions: [
        {
          action_id: "approve_request",
          value: JSON.stringify({ requestId: "req_1", organizationId: "org_1" }),
        },
      ],
    };

    const req = new Request("http://localhost/api/integrations/slack/interactions", {
      method: "POST",
      headers: {
        "x-slack-request-timestamp": "12345",
        "x-slack-signature": "v0=signature",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `payload=${encodeURIComponent(JSON.stringify(payload))}`,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.replace_original).toBe(true);
    expect(body.text).toContain("Approved ✅");
  });

  it("returns error if missing SLACK_BOT_TOKEN", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const payload = {
      type: "block_actions",
      user: { id: "U12345" },
      actions: [
        {
          action_id: "approve_request",
          value: JSON.stringify({ requestId: "req_1", organizationId: "org_1" }),
        },
      ],
    };

    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "x-slack-request-timestamp": "12345",
        "x-slack-signature": "v0=signature",
      },
      body: `payload=${encodeURIComponent(JSON.stringify(payload))}`,
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });
});
