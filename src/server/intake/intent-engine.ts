import { generateText } from "ai";
import { detectRequestIntent } from "@/server/ai/intent-detection";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";
import { parseFieldSchema } from "@/lib/request-schemas";
import { getOrgLanguageModel, isTestAiMock } from "@/server/ai/client";
import {
  INTAKE_CLARIFICATION_SYSTEM,
  buildClarificationPrompt,
} from "@/server/ai/prompts";

export type IntentResult = {
  confidence: "high" | "low" | "none";
  slug: string | null;
  payload: Record<string, unknown>;
  clarificationQuestion: string | null;
};

/**
 * Runs intent detection then classifies confidence.
 * - high: slug found + all required fields present
 * - low: slug found but required fields missing
 * - none: no slug match
 * Returns clarificationQuestion for low/none confidence.
 */
export async function runIntentEngine(
  organizationId: string,
  message: string,
): Promise<IntentResult> {
  if (isTestAiMock()) {
    return {
      confidence: "none",
      slug: null,
      payload: {},
      clarificationQuestion: "What type of access do you need?",
    };
  }

  const detected = await detectRequestIntent(organizationId, message);

  if (!detected.slug) {
    const q = await generateClarificationQuestion(
      organizationId,
      message,
      null,
      null,
      [],
    );
    return {
      confidence: "none",
      slug: null,
      payload: {},
      clarificationQuestion: q,
    };
  }

  // Check required fields
  const catalog = await fetchOrgCatalogTiles(organizationId);
  const catalogEntry = catalog.find((c) => c.slug === detected.slug) ?? null;
  const missingFields: string[] = [];

  if (catalogEntry) {
    try {
      const schema = parseFieldSchema(catalogEntry.fieldSchema);
      for (const field of schema.fields) {
        if (field.required) {
          const val = detected.payload[field.key];
          if (!val || String(val).trim() === "") {
            missingFields.push(field.label);
          }
        }
      }
    } catch {
      // schema parse failure — treat as low confidence
      missingFields.push("details");
    }
  }

  if (missingFields.length > 0) {
    const q = await generateClarificationQuestion(
      organizationId,
      message,
      detected.slug,
      catalogEntry,
      missingFields,
    );
    return {
      confidence: "low",
      slug: detected.slug,
      payload: detected.payload,
      clarificationQuestion: q,
    };
  }

  return {
    confidence: "high",
    slug: detected.slug,
    payload: detected.payload,
    clarificationQuestion: null,
  };
}

async function generateClarificationQuestion(
  organizationId: string,
  userMessage: string,
  slug: string | null,
  catalogEntry: { title: string; fieldSchema: unknown } | null,
  missingFields: string[],
): Promise<string> {
  try {
    const { model } = await getOrgLanguageModel(organizationId, "fast");
    const { text } = await generateText({
      model,
      system: INTAKE_CLARIFICATION_SYSTEM,
      prompt: buildClarificationPrompt({
        userMessage,
        detectedSlug: slug,
        catalogEntry,
        missingFields,
      }),
      maxOutputTokens: 100,
    });
    return text.trim();
  } catch {
    return missingFields.length > 0
      ? `Could you tell me the ${missingFields[0]}?`
      : "What type of access or service do you need?";
  }
}
