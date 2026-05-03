"use server";

import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { appCatalog } from "@/db/app-schema";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { resolveAiModel } from "@/server/ai/client";

export async function createAppAction(input: {
  appName: string;
  vendor: string;
  category: string;
  connectorType: string;
  ssoSupport: string;
  telemetrySupport: string;
  knownLimits: string;
  setupGuideUrl: string;
}) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Unauthorized");

  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  await db.insert(appCatalog).values({
    id: randomUUID(),
    organizationId,
    appName: input.appName,
    vendor: input.vendor,
    category: input.category,
    connectorType: input.connectorType,
    ssoSupport: input.ssoSupport,
    telemetrySupport: input.telemetrySupport,
    knownLimits: input.knownLimits || null,
    setupGuideUrl: input.setupGuideUrl || null,
  });

  revalidatePath("/admin/app-registry");
  return { ok: true };
}

export async function ingestVendorDocsAction(appId: string, url: string) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Unauthorized");
  
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("No organization found");

  let pageContent = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AetherOps-Scraper/1.0" }});
    pageContent = await res.text();
    // Simplistic HTML strip for context window
    pageContent = pageContent.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').slice(0, 15000);
  } catch (e) {
    throw new Error("Failed to fetch the provided URL.");
  }

  const model = await resolveAiModel(organizationId);
  
  const { text } = await generateText({
    model,
    system: "You are an IT compliance expert. Extract key limitations, pricing tiers, and setup rules from this vendor documentation. Format your response as a concise set of internal rules or bullet points. Keep it under 200 words.",
    prompt: `Analyze this vendor documentation:\n\n${pageContent}`,
  });

  await db.update(appCatalog)
    .set({ knownLimits: text })
    .where(eq(appCatalog.id, appId));

  revalidatePath("/admin/app-registry");
  return { ok: true };
}
