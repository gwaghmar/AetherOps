import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/ai/intent-detection", () => ({
  detectRequestIntent: vi.fn(),
}));
vi.mock("@/server/org-catalog", () => ({
  fetchOrgCatalogTiles: vi.fn().mockResolvedValue([
    {
      slug: "github_access",
      title: "GitHub Access",
      description: "Request access to GitHub",
      fieldSchema: {
        fields: [
          { key: "reason", label: "Reason", type: "text", required: true },
        ],
      },
    },
  ]),
}));
vi.mock("@/server/ai/client", () => ({
  getOrgLanguageModel: vi.fn().mockResolvedValue({ model: "mock-model" }),
  isTestAiMock: vi.fn().mockReturnValue(false),
}));

describe("IntentEngine", () => {
  it("returns confidence=high when slug is detected and required fields present", async () => {
    const { detectRequestIntent } = await import("@/server/ai/intent-detection");
    (detectRequestIntent as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "github_access",
      payload: { reason: "Production deploy" },
      reasoning: "User asked for GitHub access",
    });

    const { runIntentEngine } = await import("@/server/intake/intent-engine");
    const result = await runIntentEngine("org_1", "I need GitHub access for deployment");
    expect(result.confidence).toBe("high");
    expect(result.slug).toBe("github_access");
    expect(result.clarificationQuestion).toBeNull();
  });

  it("returns confidence=none and clarification when no slug detected", async () => {
    const { detectRequestIntent } = await import("@/server/ai/intent-detection");
    (detectRequestIntent as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: null,
      payload: {},
      reasoning: "Message too vague",
    });

    const { runIntentEngine } = await import("@/server/intake/intent-engine");
    const result = await runIntentEngine("org_1", "I need help with something");
    expect(result.confidence).toBe("none");
    expect(result.slug).toBeNull();
    expect(result.clarificationQuestion).toBeTypeOf("string");
  });
});
