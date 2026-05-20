import { z } from "zod";
import { PolicyDeniedError } from "@/lib/errors";
import { buildPayloadSchema, parseFieldSchema } from "@/lib/request-schemas";
import { getClientIp, rateLimitAllow } from "@/server/agent-rate-limit";
import {
  createRequestCore,
  findRequestTypeBySlug,
  findUserByEmailInOrg,
} from "@/server/create-request";
import { resolveChatIngestOrgId } from "@/server/tenant-resolution";
import { detectRequestIntent } from "@/server/ai/intent-detection";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;

const bodySchema = z.object({
  requestTypeSlug: z.string().min(1).max(64).optional(),
  requesterEmail: z.string().email(),
  payload: z.record(z.string(), z.unknown()).optional(),
  message: z.string().min(1).max(2000).optional(),
}).refine((data) => data.requestTypeSlug || data.message, {
  message: "Either requestTypeSlug or message must be provided",
  path: ["requestTypeSlug", "message"],
});

/**
 * Chat relay (Slack / Teams / custom bot): shared secret + fixed org for MVP.
 * Map channel → org in production; here `CHAT_INGEST_ORG_ID` selects tenant.
 */
export async function POST(req: Request) {
  const secret = process.env.CHAT_INGEST_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "Chat ingest not configured", code: "disabled" },
      { status: 503 },
    );
  }
  if (req.headers.get("X-Chat-Ingest-Secret") !== secret) {
    return Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const orgResolution = await resolveChatIngestOrgId();
  if (!orgResolution.ok) {
    return Response.json(
      { error: orgResolution.message, code: orgResolution.code },
      { status: orgResolution.httpStatus },
    );
  }
  const orgId = orgResolution.organizationId;

  const ip = getClientIp(req);
  const ipCheck = await rateLimitAllow(`chat-ingest:ip:${ip}`, 60, WINDOW_MS);
  if (!ipCheck.ok) {
    const sec = Math.max(1, Math.ceil(ipCheck.retryAfterMs / 1000));
    return Response.json(
      { error: "Too many requests", code: "rate_limit" },
      { status: 429, headers: { "Retry-After": String(sec) } },
    );
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
      { error: "Validation failed", code: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { message } = parsed.data;
  let { requestTypeSlug, payload } = parsed.data;

  // AI-assisted intent detection if no explicit slug
  if (!requestTypeSlug && message) {
    const detected = await detectRequestIntent(orgId, message);
    if (!detected.slug) {
      return Response.json(
        { 
          error: "Could not detect request intent from message", 
          code: "ambiguous_intent",
          reasoning: detected.reasoning 
        },
        { status: 422 },
      );
    }
    requestTypeSlug = detected.slug;
    payload = { ...detected.payload, ...payload };
  }

  if (!requestTypeSlug) {
    return Response.json(
      { error: "Request type slug is required", code: "missing_type" },
      { status: 400 },
    );
  }

  const type = await findRequestTypeBySlug(orgId, requestTypeSlug);
  if (!type) {
    return Response.json(
      { error: "Unknown request type slug", code: "unknown_type", slug: requestTypeSlug },
      { status: 404 },
    );
  }

  const requester = await findUserByEmailInOrg(orgId, parsed.data.requesterEmail);
  if (!requester) {
    return Response.json(
      { error: "Requester email not found in organization", code: "unknown_user" },
      { status: 404 },
    );
  }

  const fieldSchema = parseFieldSchema(type.fieldSchema);
  const payloadCheck = buildPayloadSchema(fieldSchema.fields).safeParse(payload ?? {});
  if (!payloadCheck.success) {
    return Response.json(
      {
        error: "Payload validation failed",
        code: "validation_error",
        details: payloadCheck.error.flatten(),
        message: "The message did not contain all required fields for this request type.",
      },
      { status: 422 },
    );
  }

  let id: string;
  try {
    const res = await createRequestCore({
      organizationId: orgId,
      requesterId: requester.id,
      requestTypeId: type.id,
      payload: payloadCheck.data as Record<string, unknown>,
      typeSlug: type.slug,
      typeTitle: type.title,
      typeRiskDefaults: type.riskDefaults,
      auditAction: "request_created_chat_ingest",
      auditActorId: null,
      auditMetadata: { ingest: "chat", mode: message ? "ai_assisted" : "direct" },
    });
    id = res.id;
  } catch (e) {
    if (e instanceof PolicyDeniedError) {
      return Response.json(
        { error: e.reason ?? e.message, code: "policy_denied" },
        { status: 403 },
      );
    }
    throw e;
  }

  return Response.json(
    { id, status: "pending_approval", requestTypeSlug: type.slug },
    { status: 201 },
  );
}
