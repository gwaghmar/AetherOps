import { expect, test } from "@playwright/test";

test.describe("API security", () => {
  test("fulfillment worker rejects missing bearer when CRON_SECRET is set", async ({
    request,
  }) => {
    test.skip(
      !process.env.CRON_SECRET?.trim(),
      "CRON_SECRET (set in .env.local to enable this check)",
    );

    const res = await request.post("/api/internal/worker/fulfillment");
    expect(res.status()).toBe(401);
  });

  test("fulfillment worker rejects wrong bearer", async ({ request }) => {
    test.skip(!process.env.CRON_SECRET?.trim(), "CRON_SECRET");

    const res = await request.post("/api/internal/worker/fulfillment", {
      headers: { Authorization: "Bearer definitely-wrong" },
    });
    expect(res.status()).toBe(401);
  });

  test("fulfillment worker returns 503 when CRON_SECRET unset", async ({
    request,
  }) => {
    test.skip(
      Boolean(process.env.CRON_SECRET?.trim()),
      "Skip when CRON_SECRET is set (use other tests)",
    );

    const res = await request.post("/api/internal/worker/fulfillment");
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("disabled");
  });

  test("audit export & PDF return 401 without session", async ({
    request,
  }) => {

    const q = "from=2024-01-01&to=2024-01-31";
    const csv = await request.get(`/api/admin/audit-export?${q}`);
    expect(csv.status()).toBe(401);

    const pdf = await request.get(`/api/admin/audit-pdf?${q}`);
    expect(pdf.status()).toBe(401);
  });

  test("Slack interactions returns 503 when signing secret unset", async ({
    request,
  }) => {
    test.skip(
      Boolean(process.env.SLACK_SIGNING_SECRET?.trim()),
      "Skip when SLACK_SIGNING_SECRET is set",
    );

    const res = await request.post("/api/integrations/slack/interactions", {
      data: "payload=%7B%7D",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("disabled");
  });

  test("Slack interactions returns 401 on bad signature when secret is set", async ({
    request,
  }) => {
    test.skip(
      !process.env.SLACK_SIGNING_SECRET?.trim(),
      "Set SLACK_SIGNING_SECRET in .env.local to run",
    );

    const ts = String(Math.floor(Date.now() / 1000));
    const res = await request.post("/api/integrations/slack/interactions", {
      data: "payload=%7B%7D",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Slack-Request-Timestamp": ts,
        "X-Slack-Signature": "v0=deadbeef",
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("unauthorized");
  });

  test("email approval POST rejects missing token", async ({ request }) => {

    const res = await request.post("/api/approvals/email", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/token/i);
  });

  test("email approval POST rejects garbage token", async ({ request }) => {

    const res = await request.post("/api/approvals/email", {
      data: { token: "not-a-real-token" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });
});
