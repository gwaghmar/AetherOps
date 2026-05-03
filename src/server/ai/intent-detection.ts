import { generateObject } from "ai";
import { z } from "zod";
import { getOrgLanguageModel, isTestAiMock } from "@/server/ai/client";
import { CHAT_INTENT_DETECTION_SYSTEM, buildIntentPrompt } from "@/server/ai/prompts";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";

const intentDetectionSchema = z.object({
  slug: z.string().nullable(),
  payload: z.record(z.string(), z.any()),
  reasoning: z.string(),
});

export type DetectedIntent = z.infer<typeof intentDetectionSchema>;

/**
 * Detects the request intent and extracts payload from a natural language message.
 */
export async function detectRequestIntent(
  organizationId: string,
  message: string,
): Promise<DetectedIntent> {
  if (isTestAiMock()) {
    return {
      slug: null,
      payload: {},
      reasoning: "Test mock: intent detection skipped.",
    };
  }

  const catalog = await fetchOrgCatalogTiles(organizationId);
  const { model } = await getOrgLanguageModel(organizationId);

  const { object } = await generateObject({
    model,
    schema: intentDetectionSchema,
    system: CHAT_INTENT_DETECTION_SYSTEM,
    prompt: buildIntentPrompt({ message, catalog }),
  });

  return object;
}
