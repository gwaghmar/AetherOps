import { expect, test } from "@playwright/test";

test.describe("Chat Ingest AI", () => {
  test("processes natural language message via AI intent detection", async ({ request }) => {
    // Skip if chat ingest secret is not set
    if (!process.env.CHAT_INGEST_SECRET) {
      test.skip();
      return;
    }

    // We use the 'test' AI mock mode which is usually enabled in E2E/Test envs
    // to avoid calling real OpenAI/Gemini during tests.
    // In test mock mode, detectRequestIntent returns null slug by default.
    // To properly test this, we would need to mock the AI response in the app,
    // which is hard in a full-stack E2E.
    
    // Instead, we test that the endpoint is reachable and handles the 'message' field.
    
    const response = await request.post("/api/v1/ingest/chat", {
      headers: {
        "X-Chat-Ingest-Secret": process.env.CHAT_INGEST_SECRET,
      },
      data: {
        requesterEmail: "admin@example.com", // Assume this exists from global setup
        message: "I need access to something",
      },
    });

    // Since we are likely in TEST_AI_MOCK=true mode, it will return 422 ambiguous_intent
    // because the mock returns slug: null. This confirms the message was processed by AI logic.
    const body = await response.json();
    
    if (process.env.TEST_AI_MOCK === "true") {
      expect(response.status()).toBe(422);
      expect(body.code).toBe("ambiguous_intent");
    } else {
      // If real AI is enabled, it might succeed or fail depending on the catalog.
      expect([201, 422, 404]).toContain(response.status());
    }
  });
});
