import { describe, expect, it, vi, beforeEach } from "vitest";
import { detectRequestIntent } from "@/server/ai/intent-detection";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock the catalog fetcher
vi.mock("@/server/org-catalog", () => ({
  fetchOrgCatalogTiles: vi.fn().mockResolvedValue([
    { slug: "slack_access", title: "Slack Access", description: "Request Slack", fieldSchema: {} },
  ]),
}));

// Mock the language model getter
vi.mock("@/server/ai/client", () => ({
  getOrgLanguageModel: vi.fn().mockResolvedValue({ model: {} }),
  isTestAiMock: vi.fn().mockReturnValue(false),
}));

import { generateObject } from "ai";

describe("detectRequestIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects intent and extracts payload", async () => {
    (generateObject as any).mockResolvedValue({
      object: {
        slug: "slack_access",
        payload: { email: "test@example.com" },
        reasoning: "User asked for Slack.",
      },
    });

    const result = await detectRequestIntent("org_1", "I need Slack access for test@example.com");

    expect(result.slug).toBe("slack_access");
    expect(result.payload.email).toBe("test@example.com");
    expect(generateObject).toHaveBeenCalled();
  });

  it("returns null slug for ambiguous messages", async () => {
    (generateObject as any).mockResolvedValue({
      object: {
        slug: null,
        payload: {},
        reasoning: "Message is unclear.",
      },
    });

    const result = await detectRequestIntent("org_1", "Hello world");

    expect(result.slug).toBeNull();
    expect(result.reasoning).toBe("Message is unclear.");
  });
});
