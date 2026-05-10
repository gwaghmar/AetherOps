import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationAiSettings } from "@/db/schema";
import { decryptFieldIfNeeded } from "@/lib/field-encryption";

export class AiNotConfiguredError extends Error {
  constructor(message = "AI is not configured for this organization.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export type TaskTier = "fast" | "standard" | "heavy";

function platformFallbackAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_AI_PLATFORM_FALLBACK === "true";
}

export function isTestAiMock(): boolean {
  const v = process.env.TEST_AI_MOCK?.trim();
  return v === "1" || v === "true";
}

// ─── Provider registry ────────────────────────────────────────────────────────

type ProviderDef = {
  name: string;
  envKey: string;
  models: Record<TaskTier, string>;
  makeModel: (apiKey: string, modelId: string) => LanguageModelV3;
};

const PROVIDERS: ProviderDef[] = [
  {
    name: "openai",
    envKey: "AI_OPENAI_API_KEY",
    models: { fast: "gpt-4o-mini", standard: "gpt-4o", heavy: "gpt-4o" },
    makeModel: (key, modelId) => createOpenAI({ apiKey: key })(modelId),
  },
  {
    name: "anthropic",
    envKey: "AI_ANTHROPIC_API_KEY",
    models: {
      fast: "claude-haiku-4-5-20251001",
      standard: "claude-sonnet-4-6",
      heavy: "claude-opus-4-7",
    },
    makeModel: (key, modelId) => createAnthropic({ apiKey: key })(modelId),
  },
  {
    name: "google",
    envKey: "AI_GOOGLE_API_KEY",
    models: {
      fast: "gemini-2.0-flash",
      standard: "gemini-1.5-pro",
      heavy: "gemini-1.5-pro",
    },
    makeModel: (key, modelId) =>
      createGoogleGenerativeAI({ apiKey: key })(modelId),
  },
  {
    name: "openrouter",
    envKey: "AI_OPENROUTER_API_KEY",
    models: {
      fast: "openai/gpt-4o-mini",
      standard: "anthropic/claude-sonnet-4-6",
      heavy: "anthropic/claude-opus-4-7",
    },
    makeModel: (key, modelId) =>
      createOpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" })(
        modelId,
      ),
  },
];

function getPlatformModel(
  tier: TaskTier,
): { model: LanguageModelV3; modelId: string } | null {
  if (!platformFallbackAllowed()) return null;

  // New typed provider keys — first configured key wins
  for (const provider of PROVIDERS) {
    const key = process.env[provider.envKey]?.trim();
    if (!key) continue;
    const modelId = provider.models[tier];
    return { model: provider.makeModel(key, modelId), modelId };
  }

  // Legacy: APP_AI_PLATFORM_API_KEY (OpenAI-compatible)
  const legacyKey = process.env.APP_AI_PLATFORM_API_KEY?.trim();
  if (legacyKey) {
    const baseURL = process.env.APP_AI_PLATFORM_BASE_URL?.trim();
    const modelId = process.env.APP_AI_PLATFORM_MODEL?.trim() || "gpt-4o-mini";
    const model = createOpenAI({ apiKey: legacyKey, baseURL })(modelId);
    return { model, modelId };
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type OrgAiCredentials = {
  apiKey: string;
  baseURL: string | undefined;
  model: string;
  usedPlatformFallback: boolean;
};

/** Used by setup-status and onboarding to check if AI is reachable. */
export async function getOrgAiCredentials(
  orgId: string,
): Promise<OrgAiCredentials> {
  const [row] = await db
    .select()
    .from(organizationAiSettings)
    .where(eq(organizationAiSettings.organizationId, orgId))
    .limit(1);

  if (row?.encryptedApiKey) {
    try {
      const apiKey = decryptFieldIfNeeded(row.encryptedApiKey);
      if (apiKey.trim()) {
        return {
          apiKey,
          baseURL: row.baseUrl?.trim() || undefined,
          model: row.defaultModel?.trim() || "gpt-4o-mini",
          usedPlatformFallback: false,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const platform = getPlatformModel("standard");
  if (platform) {
    return {
      apiKey: "platform",
      baseURL: undefined,
      model: platform.modelId,
      usedPlatformFallback: true,
    };
  }

  throw new AiNotConfiguredError();
}

export type OrgLanguageModelResult = {
  model: LanguageModelV3;
  modelId: string;
  usedPlatformFallback: boolean;
};

/**
 * Returns a language model for the given org and task tier.
 * Tier defaults to "standard" — existing callers work unchanged.
 * Pass "fast" for triage/classification, "heavy" for admin analysis.
 */
export async function getOrgLanguageModel(
  orgId: string,
  tier: TaskTier = "standard",
): Promise<OrgLanguageModelResult> {
  // 1. Org BYOK takes priority (OpenAI-compatible)
  const [row] = await db
    .select()
    .from(organizationAiSettings)
    .where(eq(organizationAiSettings.organizationId, orgId))
    .limit(1);

  if (row?.encryptedApiKey) {
    try {
      const apiKey = decryptFieldIfNeeded(row.encryptedApiKey);
      if (apiKey.trim()) {
        const baseURL = row.baseUrl?.trim() || undefined;
        const modelId = row.defaultModel?.trim() || "gpt-4o-mini";
        const model = createOpenAI({ apiKey, baseURL })(modelId);
        return { model, modelId, usedPlatformFallback: false };
      }
    } catch {
      /* fall through to platform */
    }
  }

  // 2. Platform provider chain
  const platform = getPlatformModel(tier);
  if (platform) {
    return { ...platform, usedPlatformFallback: true };
  }

  throw new AiNotConfiguredError();
}

export async function testOrgAiConnection(orgId: string): Promise<{
  ok: boolean;
  message: string;
  usedPlatformFallback?: boolean;
}> {
  if (isTestAiMock()) {
    return {
      ok: true,
      message: "TEST_AI_MOCK: skipped live call.",
      usedPlatformFallback: false,
    };
  }
  try {
    const { model, usedPlatformFallback } = await getOrgLanguageModel(
      orgId,
      "fast",
    );
    const { text } = await generateText({
      model,
      prompt: "Reply with exactly the word OK and nothing else.",
      maxOutputTokens: 16,
    });
    const ok = text.trim().toUpperCase().includes("OK");
    return {
      ok,
      message: ok
        ? "Connection OK."
        : `Unexpected model response: ${text.slice(0, 80)}`,
      usedPlatformFallback,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, message: msg };
  }
}
