import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getSession } from "@/lib/session";
import {
  AiNotConfiguredError,
  getOrgLanguageModel,
} from "@/server/ai/client";
import { HOME_COPILOT_SYSTEM } from "@/server/ai/prompts";
import { assertAiRequestGuard } from "@/server/ai/request-guard";
import { recordAuditEvent } from "@/server/audit";
import { db } from "@/db";
import { appCatalog, oktaGroupMapping } from "@/db/app-schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const orgId = session.user.organizationId;
  if (!orgId) {
    return new Response("No organization", { status: 403 });
  }

  let body: { messages?: UIMessage[] };
  try {
    body = (await req.json()) as { messages?: UIMessage[] };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const messages = body.messages ?? [];
  if (!Array.isArray(messages)) {
    return new Response("messages must be an array", { status: 400 });
  }
  try {
    await assertAiRequestGuard({
      req,
      organizationId: orgId,
      userId: session.user.id,
      messages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rate limit exceeded";
    const status = typeof (e as { status?: unknown })?.status === "number"
      ? ((e as { status: number }).status)
      : 429;
    return new Response(message, { status });
  }

  try {
    const { model, usedPlatformFallback } = await getOrgLanguageModel(orgId, "standard");
    const actorId = session.user.id;
    
    // Inject dynamic contextual awareness of the App Catalog to power MVP
    const apps = await db.select().from(appCatalog).where(eq(appCatalog.organizationId, orgId));
    const groups = await db.select().from(oktaGroupMapping).where(eq(oktaGroupMapping.organizationId, orgId));
    
    let catalogContext = "\n\nApp Catalog & Knowledge Base Reference:\n";
    if (apps.length > 0) {
      apps.forEach(app => {
        catalogContext += `- ${app.appName} (Vendor: ${app.vendor}, Category: ${app.category})\n  Connector: ${app.connectorType}. Telemetry: ${app.telemetrySupport}.\n  Docs: ${app.setupGuideUrl}\n  Limits: ${app.knownLimits}\n`;
      });
    } else {
      catalogContext += "No apps seeded yet.\n";
    }
    
    if (groups.length > 0) {
      catalogContext += "\nOkta Policy Group Rules:\n";
      groups.forEach(g => {
        catalogContext += `- Identity Group: ${g.groupName} triggers automated mapping for request template: ${g.requestTypeId}\n`;
      });
    }

    const system =
      HOME_COPILOT_SYSTEM +
      catalogContext +
      (usedPlatformFallback
        ? "\nNote: this reply used the platform fallback API key for the organization."
        : "");
        
    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      onFinish: () => {
        if (usedPlatformFallback) {
          void recordAuditEvent({
            organizationId: orgId,
            actorId,
            entityType: "organization",
            entityId: orgId,
            action: "ai_copilot_platform_fallback",
            metadata: { usedPlatformKey: true },
          });
        }
      },
    });
    return result.toUIMessageStreamResponse();
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return Response.json(
        { error: e.message, code: "ai_not_configured" },
        { status: 503 },
      );
    }
    throw e;
  }
}
