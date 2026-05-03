import { z } from "zod";
import { db } from "@/db";
import { aiUsageTelemetry } from "@/db/schema";
import { resolveAgentApiKey } from "@/server/agent-auth";
import { randomUUID } from "node:crypto";
import { findUserByEmailInOrg } from "@/server/create-request";

export const runtime = "nodejs";

const telemetrySchema = z.object({
  records: z.array(z.object({
    userEmail: z.string().email(),
    appId: z.string().optional(),
    modelName: z.string().min(1),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.string().optional(),
    budgetOwnerEmail: z.string().email().optional(),
  })).min(1).max(100),
});

/**
 * Inbound telemetry for AI tool usage.
 * POST /api/v1/telemetry/ai
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const ctx = await resolveAgentApiKey(authHeader);
  if (!ctx) {
    return Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 });
  }

  const parsed = telemetrySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Validation failed",
        code: "validation_error",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const inserts = [];
  for (const record of parsed.data.records) {
    // Attempt to map emails to internal user IDs
    const user = await findUserByEmailInOrg(ctx.organizationId, record.userEmail);
    const budgetOwner = record.budgetOwnerEmail 
      ? await findUserByEmailInOrg(ctx.organizationId, record.budgetOwnerEmail)
      : null;

    inserts.push({
      id: randomUUID(),
      organizationId: ctx.organizationId,
      userId: user?.id ?? null,
      appId: record.appId ?? null,
      modelName: record.modelName,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      estimatedCostUsd: record.estimatedCostUsd ?? "0",
      budgetOwnerId: budgetOwner?.id ?? null,
    });
  }

  if (inserts.length > 0) {
    await db.insert(aiUsageTelemetry).values(inserts);
  }

  return Response.json({ ok: true, count: inserts.length }, { status: 201 });
}
