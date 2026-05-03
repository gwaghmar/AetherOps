"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  apiKey,
  approvalRoutingRule,
  changeTemplate,
  changeTicket,
  organization,
  request as requestTable,
  requestType,
  user,
} from "@/db/schema";
import { generateApiKeyMaterial } from "@/lib/api-key-crypto";
import { encryptFieldIfConfigured } from "@/lib/field-encryption";
import { parseFieldSchema } from "@/lib/request-schemas";
import { assertSafeOutboundHttpUrl } from "@/lib/safe-url";
import { requireSession } from "@/lib/session";

const roleSchema = z.enum(["requester", "approver", "admin"]);
/** Better Auth user ids are opaque strings, not always UUIDs. */
const authUserIdSchema = z.string().min(1);

function requireAdminOrg(session: {
  user: { role?: string | null; organizationId?: string | null };
}) {
  const role = session.user.role ?? "requester";
  if (role !== "admin") throw new Error("Admin only.");
  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization.");
  return orgId;
}

export async function adminSetUserRole(input: {
  userId: string;
  role: string;
}) {
  const parsed = z
    .object({ userId: authUserIdSchema, role: roleSchema })
    .safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);
  if (parsed.data.userId === session.user.id) {
    throw new Error("You cannot change your own role here.");
  }

  const [target] = await db
    .select()
    .from(user)
    .where(and(eq(user.id, parsed.data.userId), eq(user.organizationId, orgId)))
    .limit(1);

  if (!target) throw new Error("User not found in this organization.");

  await db
    .update(user)
    .set({ role: parsed.data.role })
    .where(eq(user.id, target.id));

  revalidatePath("/admin/users");
  return { ok: true as const };
}

const typeFields = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fieldSchemaJson: z.string().min(2),
  riskDefaultsJson: z.string().min(2),
  connectorId: z.string().max(64).nullable().optional(),
});

export async function adminCreateRequestType(input: {
  slug: string;
  title: string;
  description?: string;
  fieldSchemaJson: string;
  riskDefaultsJson: string;
  connectorId?: string | null;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const parsed = typeFields.safeParse(input);
  if (!parsed.success) throw new Error("Invalid catalog fields");

  let fieldSchema: unknown;
  let riskDefaults: unknown;
  try {
    fieldSchema = JSON.parse(parsed.data.fieldSchemaJson) as unknown;
    riskDefaults = JSON.parse(parsed.data.riskDefaultsJson) as unknown;
  } catch {
    throw new Error("fieldSchema and riskDefaults must be valid JSON");
  }

  parseFieldSchema(fieldSchema);

  await db.insert(requestType).values({
    id: randomUUID(),
    organizationId: orgId,
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    fieldSchema,
    riskDefaults,
    connectorId: parsed.data.connectorId ?? null,
  });

  revalidatePath("/admin/types");
  revalidatePath("/requests/new");
  revalidatePath("/");
  revalidatePath("/requests");
  return { ok: true as const };
}

export async function adminUpdateRequestType(input: {
  id: string;
  slug: string;
  title: string;
  description?: string;
  fieldSchemaJson: string;
  riskDefaultsJson: string;
  connectorId?: string | null;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const parsed = typeFields.extend({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid catalog fields");

  let fieldSchema: unknown;
  let riskDefaults: unknown;
  try {
    fieldSchema = JSON.parse(parsed.data.fieldSchemaJson) as unknown;
    riskDefaults = JSON.parse(parsed.data.riskDefaultsJson) as unknown;
  } catch {
    throw new Error("fieldSchema and riskDefaults must be valid JSON");
  }

  parseFieldSchema(fieldSchema);

  const [row] = await db
    .select()
    .from(requestType)
    .where(
      and(eq(requestType.id, parsed.data.id), eq(requestType.organizationId, orgId)),
    )
    .limit(1);

  if (!row) throw new Error("Type not found.");

  await db
    .update(requestType)
    .set({
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fieldSchema,
      riskDefaults,
      connectorId: parsed.data.connectorId ?? null,
    })
    .where(eq(requestType.id, row.id));

  revalidatePath("/admin/types");
  revalidatePath("/requests/new");
  revalidatePath("/");
  revalidatePath("/requests");
  return { ok: true as const };
}

export async function adminDeleteRequestType(input: { id: string }) {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid id");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const [row] = await db
    .select()
    .from(requestType)
    .where(
      and(eq(requestType.id, parsed.data.id), eq(requestType.organizationId, orgId)),
    )
    .limit(1);

  if (!row) throw new Error("Type not found.");

  const [usage] = await db
    .select({ n: count() })
    .from(requestTable)
    .where(eq(requestTable.requestTypeId, row.id));

  if (row.archivedAt) {
    if (usage.n > 0) {
      throw new Error("This type is already archived.");
    }
    await db.delete(requestType).where(eq(requestType.id, row.id));
  } else if (usage.n > 0) {
    await db
      .update(requestType)
      .set({ archivedAt: new Date() })
      .where(eq(requestType.id, row.id));
  } else {
    await db.delete(requestType).where(eq(requestType.id, row.id));
  }

  revalidatePath("/admin/types");
  revalidatePath("/requests/new");
  revalidatePath("/");
  revalidatePath("/requests");
  return { ok: true as const };
}

export async function adminCreateApiKey(input: {
  name: string;
  allowedSlugs?: string | null;
}) {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      allowedSlugs: z.string().optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  let allowedTypeSlugs: string[] | null = null;
  if (parsed.data.allowedSlugs?.trim()) {
    allowedTypeSlugs = parsed.data.allowedSlugs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedTypeSlugs.length === 0) allowedTypeSlugs = null;
  }

  const { fullKey, lookupId, keyHash } = generateApiKeyMaterial();

  await db.insert(apiKey).values({
    id: randomUUID(),
    organizationId: orgId,
    name: parsed.data.name,
    lookupId,
    keyHash,
    allowedTypeSlugs,
  });

  revalidatePath("/admin/api-keys");
  return { ok: true as const, fullKey };
}

export async function adminUpdateOrgWebhooks(input: {
  webhookUrl: string;
  /** Empty string clears. Omit or leave blank to leave unchanged (not represented — use clear flag). */
  webhookSigningSecret: string;
  clearSecret: boolean;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const boundary = z
    .object({
      webhookUrl: z.string().max(2000),
      webhookSigningSecret: z.string().max(500),
      clearSecret: z.boolean(),
    })
    .safeParse(input);
  if (!boundary.success) throw new Error("Invalid webhook settings.");

  const rawUrl = boundary.data.webhookUrl.trim();
  const url = rawUrl.length > 0 ? assertSafeOutboundHttpUrl(rawUrl) : "";
  let secret: string | null | undefined;
  if (boundary.data.clearSecret) {
    secret = null;
  } else if (boundary.data.webhookSigningSecret.trim()) {
    secret = encryptFieldIfConfigured(
      boundary.data.webhookSigningSecret.trim(),
    );
  } else {
    const [row] = await db
      .select({ webhookSigningSecret: organization.webhookSigningSecret })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    secret = row?.webhookSigningSecret ?? null;
  }

  await db
    .update(organization)
    .set({
      webhookUrl: url.length > 0 ? url : null,
      webhookSigningSecret: secret ?? null,
    })
    .where(eq(organization.id, orgId));

  revalidatePath("/admin/integrations");
  return { ok: true as const };
}

/**
 * Persist the Slack workspace id (team_id) for the session org.
 * Empty string clears the mapping; unique index prevents cross-tenant conflicts.
 */
export async function adminUpdateSlackTeamId(input: { slackTeamId: string }) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const boundary = z
    .object({ slackTeamId: z.string().max(32) })
    .safeParse(input);
  if (!boundary.success) throw new Error("Invalid Slack team ID.");

  const value = boundary.data.slackTeamId.trim() || null;

  try {
    await db
      .update(organization)
      .set({ slackTeamId: value })
      .where(eq(organization.id, orgId));
  } catch (err: unknown) {
    // Unique constraint: another org already owns this workspace id.
    if (err instanceof Error && err.message.includes("organization_slack_team_id_unique")) {
      return { ok: false as const, error: "This Slack workspace is already mapped to another organization." };
    }
    throw err;
  }

  revalidatePath("/admin/integrations");
  return { ok: true as const };
}

const bulkCatalogItem = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fieldSchema: z.unknown(),
  riskDefaults: z.unknown(),
});

/** Insert many request types in one transaction (onboarding / AI apply). */
export async function adminBulkCreateRequestTypes(input: {
  items: z.infer<typeof bulkCatalogItem>[];
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const parsed = z.array(bulkCatalogItem).min(1).max(20).safeParse(input.items);
  if (!parsed.success) throw new Error("Invalid catalog batch");

  await db.transaction(async (tx) => {
    for (const item of parsed.data) {
      parseFieldSchema(item.fieldSchema);
      const riskDefaults =
        typeof item.riskDefaults === "object" &&
        item.riskDefaults !== null &&
        !Array.isArray(item.riskDefaults)
          ? item.riskDefaults
          : {};
      const [dup] = await tx
        .select({ id: requestType.id })
        .from(requestType)
        .where(
          and(
            eq(requestType.organizationId, orgId),
            eq(requestType.slug, item.slug),
            isNull(requestType.archivedAt),
          ),
        )
        .limit(1);
      if (dup) {
        throw new Error(`Duplicate slug in batch or catalog: ${item.slug}`);
      }
      await tx.insert(requestType).values({
        id: randomUUID(),
        organizationId: orgId,
        slug: item.slug,
        title: item.title,
        description: item.description ?? null,
        fieldSchema: item.fieldSchema,
        riskDefaults,
      });
    }
  });

  revalidatePath("/admin/types");
  revalidatePath("/requests/new");
  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath("/onboarding");
  return { ok: true as const };
}

export async function adminRevokeApiKey(input: { id: string }) {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid id");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(apiKey.id, parsed.data.id), eq(apiKey.organizationId, orgId)),
    );

  revalidatePath("/admin/api-keys");
  return { ok: true as const };
}

function normalizeRoutingRequestTypeId(
  value: string | null | undefined,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "__all__"
  ) {
    return null;
  }
  return value;
}

export async function adminAddRoutingRule(input: {
  requestTypeId: string | null | undefined;
  approverUserId: string;
  sortOrder?: number;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const typeId = normalizeRoutingRequestTypeId(input.requestTypeId);

  const parsed = z
    .object({
      approverUserId: authUserIdSchema,
      sortOrder: z.number().int().min(0).max(9999).optional(),
    })
    .safeParse({
      approverUserId: input.approverUserId,
      sortOrder: input.sortOrder,
    });
  if (!parsed.success) throw new Error("Invalid routing rule input.");
  if (typeId !== null && !z.string().uuid().safeParse(typeId).success) {
    throw new Error("Invalid request type.");
  }

  const [approver] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, parsed.data.approverUserId),
        eq(user.organizationId, orgId),
        or(eq(user.role, "approver"), eq(user.role, "admin")),
      ),
    )
    .limit(1);

  if (!approver) {
    throw new Error("Approver must be an approver or admin in this org.");
  }

  if (typeId) {
    const [t] = await db
      .select({ id: requestType.id })
      .from(requestType)
      .where(
        and(
          eq(requestType.id, typeId),
          eq(requestType.organizationId, orgId),
          isNull(requestType.archivedAt),
        ),
      )
      .limit(1);
    if (!t) throw new Error("Request type not found or archived.");
  }

  await db.insert(approvalRoutingRule).values({
    id: randomUUID(),
    organizationId: orgId,
    requestTypeId: typeId,
    approverUserId: parsed.data.approverUserId,
    sortOrder: parsed.data.sortOrder ?? 0,
  });

  revalidatePath("/admin/routing");
  return { ok: true as const };
}

export async function adminDeleteRoutingRule(input: { id: string }) {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid id");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const [row] = await db
    .select({ id: approvalRoutingRule.id })
    .from(approvalRoutingRule)
    .where(
      and(
        eq(approvalRoutingRule.id, parsed.data.id),
        eq(approvalRoutingRule.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Rule not found.");

  await db
    .delete(approvalRoutingRule)
    .where(eq(approvalRoutingRule.id, row.id));

  revalidatePath("/admin/routing");
  return { ok: true as const };
}

const changeTemplateFields = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fieldSchemaJson: z.string().min(2),
});

export async function adminCreateChangeTemplate(input: {
  slug: string;
  title: string;
  description?: string;
  fieldSchemaJson: string;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const parsed = changeTemplateFields.safeParse(input);
  if (!parsed.success) throw new Error("Invalid change template fields");

  let fieldSchema: unknown;
  try {
    fieldSchema = JSON.parse(parsed.data.fieldSchemaJson) as unknown;
  } catch {
    throw new Error("fieldSchema must be valid JSON");
  }

  parseFieldSchema(fieldSchema);

  await db.insert(changeTemplate).values({
    id: randomUUID(),
    organizationId: orgId,
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    fieldSchema,
  });

  revalidatePath("/admin/change-templates");
  revalidatePath("/changes/new");
  return { ok: true as const };
}

export async function adminUpdateChangeTemplate(input: {
  id: string;
  slug: string;
  title: string;
  description?: string;
  fieldSchemaJson: string;
}) {
  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const parsed = changeTemplateFields.extend({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid change template fields");

  let fieldSchema: unknown;
  try {
    fieldSchema = JSON.parse(parsed.data.fieldSchemaJson) as unknown;
  } catch {
    throw new Error("fieldSchema must be valid JSON");
  }

  parseFieldSchema(fieldSchema);

  const [row] = await db
    .select()
    .from(changeTemplate)
    .where(
      and(
        eq(changeTemplate.id, parsed.data.id),
        eq(changeTemplate.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Change template not found.");

  await db
    .update(changeTemplate)
    .set({
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fieldSchema,
    })
    .where(eq(changeTemplate.id, row.id));

  revalidatePath("/admin/change-templates");
  revalidatePath("/changes/new");
  return { ok: true as const };
}

export async function adminDeleteChangeTemplate(input: { id: string }) {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new Error("Invalid id");

  const session = await requireSession();
  const orgId = requireAdminOrg(session);

  const [row] = await db
    .select()
    .from(changeTemplate)
    .where(
      and(
        eq(changeTemplate.id, parsed.data.id),
        eq(changeTemplate.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Change template not found.");

  const [usage] = await db
    .select({ n: count() })
    .from(changeTicket)
    .where(eq(changeTicket.changeTemplateId, row.id));

  if (usage.n > 0) {
    throw new Error("Cannot delete a template that has existing change tickets.");
  }

  await db.delete(changeTemplate).where(eq(changeTemplate.id, row.id));

  revalidatePath("/admin/change-templates");
  revalidatePath("/changes/new");
  return { ok: true as const };
}
