import { z } from "zod";
import { parseApiKeyLookupId } from "@/lib/api-key-crypto";
import { PolicyDeniedError } from "@/lib/errors";
import { buildPayloadSchema, parseFieldSchema } from "@/lib/request-schemas";
import { resolveAgentApiKey } from "@/server/agent-auth";
import { getClientIp, rateLimitAllow } from "@/server/agent-rate-limit";
import {
  createRequestCore,
  findRequestTypeBySlug,
  findUserByEmailInOrg,
} from "@/server/create-request";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;

function parseLimit(env: string | undefined, fallback: number) {
  const n = Number.parseInt(env ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function tooMany(retryAfterMs: number) {
  const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return Response.json(
    { error: "Too many requests", code: "rate_limit" },
    {
      status: 429,
      headers: { "Retry-After": String(sec) },
    },
  );
}

const bodySchema = z.object({
  requestTypeSlug: z.string().min(1).max(64),
  requesterEmail: z.string().email(),
  payload: z.record(z.string(), z.unknown()),
  durationHours: z.number().int().min(1).max(8760).optional(),
});

export async function POST(req: Request) {
  const ipLimit = parseLimit(
    process.env.AGENT_API_RATE_LIMIT_IP_PER_MIN,
    120,
  );
  const keyLimit = parseLimit(
    process.env.AGENT_API_RATE_LIMIT_KEY_PER_MIN,
    60,
  );

  const ip = getClientIp(req);
  const ipCheck = await rateLimitAllow(`agent-v1:ip:${ip}`, ipLimit, WINDOW_MS);
  if (!ipCheck.ok) {
    return tooMany(ipCheck.retryAfterMs);
  }

  const authHeader = req.headers.get("authorization");
  const parsedBearer = parseApiKeyLookupId(authHeader);
  if (parsedBearer) {
    const keyCheck = await rateLimitAllow(
      `agent-v1:lk:${parsedBearer.lookupId}`,
      keyLimit,
      WINDOW_MS,
    );
    if (!keyCheck.ok) {
      return tooMany(keyCheck.retryAfterMs);
    }
  }

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

  const parsed = bodySchema.safeParse(json);
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

  const type = await findRequestTypeBySlug(
    ctx.organizationId,
    parsed.data.requestTypeSlug,
  );
  if (!type) {
    return Response.json(
      { error: "Unknown request type slug", code: "unknown_type" },
      { status: 404 },
    );
  }

  if (ctx.allowedTypeSlugs && !ctx.allowedTypeSlugs.includes(type.slug)) {
    return Response.json(
      {
        error: "Your API key is not authorized to create this request type.",
        code: "forbidden",
      },
      { status: 403 },
    );
  }

  const requester = await findUserByEmailInOrg(
    ctx.organizationId,
    parsed.data.requesterEmail,
  );
  if (!requester) {
    return Response.json(
      { error: "Requester email not found in organization", code: "unknown_user" },
      { status: 404 },
    );
  }

  const fieldSchema = parseFieldSchema(type.fieldSchema);
  const payloadCheck = buildPayloadSchema(fieldSchema.fields).safeParse(
    parsed.data.payload,
  );
  if (!payloadCheck.success) {
    return Response.json(
      {
        error: "Payload validation failed",
        code: "validation_error",
        details: payloadCheck.error.flatten(),
      },
      { status: 422 },
    );
  }

  let expiresAt: Date | null = null;
  if (parsed.data.durationHours) {
    expiresAt = new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000);
    if (expiresAt <= new Date()) {
      return Response.json(
        { error: "durationHours must result in a future expiry", code: "validation_error" },
        { status: 400 },
      );
    }
  }

  let id: string;
  try {
    const res = await createRequestCore({
      organizationId: ctx.organizationId,
      requesterId: requester.id,
      requestTypeId: type.id,
      payload: payloadCheck.data as Record<string, unknown>,
      typeSlug: type.slug,
      typeTitle: type.title,
      typeRiskDefaults: type.riskDefaults,
      auditAction: "request_created_agent_api",
      auditActorId: null,
      auditMetadata: { apiKeyId: ctx.apiKeyId },
      idempotencyKey: req.headers.get("idempotency-key"),
      expiresAt,
    });
    id = res.id;
  } catch (e) {
    if (e instanceof PolicyDeniedError) {
      return Response.json(
        {
          error: e.reason ?? e.message,
          code: "policy_denied",
        },
        { status: 403 },
      );
    }
    throw e;
  }

  return Response.json(
    {
      id,
      status: "pending_approval",
      requestTypeSlug: type.slug,
    },
    { status: 201 },
  );
}
