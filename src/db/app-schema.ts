import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** Outbound webhook (Slack/custom receiver). POST with HMAC signature when set. */
    webhookUrl: text("webhook_url"),
    /** Optional secret for `X-Governance-Signature` (HMAC-SHA256 of raw body). */
    webhookSigningSecret: text("webhook_signing_secret"),
    /** Slack workspace id for canonical tenant resolution. Unique when set; null = unmapped. */
    slackTeamId: text("slack_team_id"),
    /** Stripe billing */
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionStatus: text("stripe_subscription_status"),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /** Unique across non-null Slack workspace ids -- prevents cross-tenant confusion. */
    uniqueIndex("organization_slack_team_id_unique")
      .on(t.slackTeamId)
      .where(sql`${t.slackTeamId} is not null`),
  ],
);

/** Agent/service credentials: store hash only; plaintext shown once on create. */
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Public id embedded in key (`gk_<lookupId>_…`) for O(1) lookup. */
    lookupId: text("lookup_id").notNull().unique(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Optional explicit allowlist of request type slugs this token can trigger */
    allowedTypeSlugs: jsonb("allowed_type_slugs").$type<string[] | null>(),
  },
  (t) => [index("api_key_org_idx").on(t.organizationId)],
);

export const requestType = pgTable(
  "request_type",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    fieldSchema: jsonb("field_schema").notNull().$type<unknown>(),
    riskDefaults: jsonb("risk_defaults").notNull().$type<unknown>(),
    appCatalogId: text("app_catalog_id"), // Reference to the app_catalog, added via relations below
    /** Optional per-type connector override (github, google_workspace, http_webhook, manual_ticketing, etc.). Falls back to global PROVISION_CONNECTOR env when null. */
    connectorId: text("connector_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Soft-delete: set instead of hard-deleting so existing requests are not orphaned. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Optional SLA in hours. When set, requests of this type get an approval_deadline_at at creation. */
    slaHours: integer("sla_hours"),
  },
  (t) => [
    /** Slug unique among non-archived rows so a new type can reuse a retired slug. */
    uniqueIndex("request_type_org_slug_unique")
      .on(t.organizationId, t.slug)
      .where(sql`${t.archivedAt} is null`),
  ],
);

export const request = pgTable(
  "request",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestTypeId: text("request_type_id")
      .notNull()
      .references(() => requestType.id, { onDelete: "restrict" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedApproverId: text("assigned_approver_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    /** Frozen at creation: user ids allowed to approve (from routing rules). */
    routingApproverIds: jsonb("routing_approver_ids").$type<string[] | null>(),
    /** AI triage risk level: low | medium | high | critical */
    aiTriageRisk: text("ai_triage_risk"),
    /** One-sentence reason from the triage model. */
    aiTriageReason: text("ai_triage_reason"),
    aiTriageAt: timestamp("ai_triage_at", { withTimezone: true }),
    
    /** RLY-01: Retry-safe creation key */
    idempotencyKey: text("idempotency_key"),
    
    /** JIT and Emergency Override primitives */
    isEmergencyOverride: boolean("is_emergency_override").default(false).notNull(),
    overrideReason: text("override_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Track if the 2-hour pre-expiry notification was successfully dispatched. */
    preExpiryNotifiedAt: timestamp("pre_expiry_notified_at", { withTimezone: true }),
    /** Optional note from requester shown to all approvers. */
    requesterNote: text("requester_note"),
    /** Set at request creation: now() + sla_hours if request_type.sla_hours is set. */
    approvalDeadlineAt: timestamp("approval_deadline_at", { withTimezone: true }),
    /** Set by SLA cron when breach is detected (idempotency guard). */
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    /** Set by SLA cron when reminder emails are sent. */
    slaReminderSentAt: timestamp("sla_reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("request_org_status_idx").on(t.organizationId, t.status),
    index("request_approver_status_idx").on(
      t.assignedApproverId,
      t.status,
    ),
    uniqueIndex("request_org_idempotency_key_idx")
      .on(t.organizationId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

/**
 * Maps request types (or org default when request_type_id is null) to approvers.
 * Lower sort_order is evaluated first; first match wins for primary assignee.
 */
export const approvalRoutingRule = pgTable(
  "approval_routing_rule",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** When null, rule applies as org-wide fallback for any type. */
    requestTypeId: text("request_type_id").references(() => requestType.id, {
      onDelete: "cascade",
    }),
    approverUserId: text("approver_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("approval_routing_rule_org_idx").on(t.organizationId),
    index("approval_routing_rule_type_idx").on(t.requestTypeId),
  ],
);

/** One-time ids for email approval links (replay protection). */
export const approvalEmailNonce = pgTable(
  "approval_email_nonce",
  {
    jti: text("jti").primaryKey(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("approval_email_nonce_created_idx").on(t.createdAt)],
);

export const approval = pgTable(
  "approval",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "cascade" }),
    /** Nullable for system/AI auto-approvals. */
    approverId: text("approver_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decision: text("decision").notNull(),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("approval_request_idx").on(t.requestId),
    // approverId is non-null for all terminal approval rows in this implementation
    // (human decisions and emergency overrides both supply a real userId).
    // The unique index therefore correctly enforces one terminal decision per (request, approver).
    uniqueIndex("approval_request_approver_terminal_unique")
      .on(t.requestId, t.approverId)
      .where(sql`${t.decision} in ('approved', 'denied')`),
  ],
);

/** Durable async fulfillment work (provision connector). */
export const fulfillmentJob = pgTable(
  "fulfillment_job",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** provision | revoke */
    jobType: text("job_type").notNull().default("provision"),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("fulfillment_job_org_status_idx").on(t.organizationId, t.status),
    index("fulfillment_job_request_idx").on(t.requestId),
    uniqueIndex("fulfillment_job_request_open_unique")
      .on(t.requestId, t.jobType)
      .where(sql`${t.status} in ('pending', 'processing')`),
  ],
);

/** Templates for governed change / release tickets (report, ETL, etc.). */
export const changeTemplate = pgTable(
  "change_template",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    fieldSchema: jsonb("field_schema").notNull().$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("change_template_org_slug_unique").on(
      t.organizationId,
      t.slug,
    ),
  ],
);

/** Linear change-management pipeline: On deck → UAT → prod gate → closed. */
export const changeTicket = pgTable(
  "change_ticket",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    changeTemplateId: text("change_template_id")
      .notNull()
      .references(() => changeTemplate.id, { onDelete: "restrict" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    stage: text("stage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("change_ticket_org_stage_idx").on(t.organizationId, t.stage),
    index("change_ticket_requester_idx").on(t.requesterId),
    index("change_ticket_assigned_idx").on(t.assignedUserId),
    index("change_ticket_org_created_idx").on(t.organizationId, t.createdAt),
  ],
);

/**
 * Durable outbound webhook delivery log with retry.
 * Statuses: pending → delivering → delivered | failed (exhausted)
 */
export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    targetUrl: text("target_url").notNull(),
    signingSecret: text("signing_secret"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("webhook_delivery_org_status_idx").on(t.organizationId, t.status),
    index("webhook_delivery_next_retry_idx").on(t.nextRetryAt),
    index("webhook_delivery_status_retry_idx").on(t.status, t.nextRetryAt),
  ],
);

export const webhookDeliveryRelations = relations(webhookDelivery, ({ one }) => ({
  organization: one(organization, {
    fields: [webhookDelivery.organizationId],
    references: [organization.id],
  }),
}));

/** Append-only audit stream: application code must only INSERT. */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Per-org AI provider (BYOK); optional platform fallback via env when key null. */
export const organizationAiSettings = pgTable("organization_ai_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** e.g. openai_compatible */
  provider: text("provider").notNull().default("openai_compatible"),
  baseUrl: text("base_url"),
  defaultModel: text("default_model").notNull().default("gpt-4o-mini"),
  /** Encrypted or plaintext API key (use FIELD_ENCRYPTION_KEY in prod). */
  encryptedApiKey: text("encrypted_api_key"),
  keyLastFour: text("key_last_four"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
});

/** First-run wizard + setup checklist state. */
export const organizationOnboarding = pgTable("organization_onboarding", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  wizardVersion: integer("wizard_version").notNull().default(1),
  wizardCompletedAt: timestamp("wizard_completed_at", { withTimezone: true }),
  steps: jsonb("steps")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
});

/** Email invites: raw token is shown once; only sha256 hash stored. */
export const organizationInvite = pgTable(
  "organization_invite",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("requester"),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    index("organization_invite_org_idx").on(t.organizationId),
    index("organization_invite_email_idx").on(t.organizationId, t.email),
  ],
);

/**
 * Org-level transactional email override (Phase C: Graph/Gmail OAuth).
 * When absent, app uses RESEND_API_KEY from env.
 */
export const organizationEmailSettings = pgTable("organization_email_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("resend_env"),
  /** Non-secret config (e.g. from address display name). */
  fromAddress: text("from_address"),
  /** Encrypted JSON: refresh tokens, SMTP password, etc. */
  encryptedCredentials: text("encrypted_credentials"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/** Encrypted vault for integration tokens/keys (linear, slack, aws, etc.). */
export const connectorCredential = pgTable(
  "connector_credential",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    connectorId: text("connector_id").notNull(),
    encryptedData: text("encrypted_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("connector_credential_org_connector_unique").on(
      t.organizationId,
      t.connectorId,
    ),
  ]
);

export const accessReviewCampaign = pgTable("access_review_campaign", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"), // "active" | "completed"
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const accessReviewItem = pgTable("access_review_item", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => accessReviewCampaign.id, { onDelete: "cascade" }),
  requestId: text("request_id")
    .notNull()
    .references(() => request.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  decision: text("decision"), // "keep" | "revoke"
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const accessReviewCampaignRelations = relations(accessReviewCampaign, ({ one, many }) => ({
  organization: one(organization, {
    fields: [accessReviewCampaign.organizationId],
    references: [organization.id],
  }),
  items: many(accessReviewItem),
}));

export const accessReviewItemRelations = relations(accessReviewItem, ({ one }) => ({
  campaign: one(accessReviewCampaign, {
    fields: [accessReviewItem.campaignId],
    references: [accessReviewCampaign.id],
  }),
  request: one(request, {
    fields: [accessReviewItem.requestId],
    references: [request.id],
  }),
  reviewer: one(user, {
    fields: [accessReviewItem.reviewerId],
    references: [user.id],
  }),
}));

export const organizationAiSettingsRelations = relations(
  organizationAiSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationAiSettings.organizationId],
      references: [organization.id],
    }),
    updatedBy: one(user, {
      fields: [organizationAiSettings.updatedByUserId],
      references: [user.id],
    }),
  }),
);

/** Unified App Catalog serving as the central knowledge and registry DB */
export const appCatalog = pgTable("app_catalog", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  appName: text("app_name").notNull(),
  vendor: text("vendor").notNull(),
  category: text("category").notNull(),
  connectorType: text("connector_type").notNull().default("manual_ticketing"),
  ssoSupport: text("sso_support").notNull().default("false"),
  telemetrySupport: text("telemetry_support").notNull().default("none"),
  knownLimits: text("known_limits"),
  setupGuideUrl: text("setup_guide_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Maps Okta / Google Workspace Groups to Request Types */
export const oktaGroupMapping = pgTable("okta_group_mapping", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  groupName: text("group_name").notNull(),
  requestTypeId: text("request_type_id")
    .notNull()
    .references(() => requestType.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("okta_group_mapping_org_group_type_unique").on(t.organizationId, t.groupName, t.requestTypeId)
]);

export const appCatalogRelations = relations(appCatalog, ({ one, many }) => ({
  organization: one(organization, {
    fields: [appCatalog.organizationId],
    references: [organization.id],
  }),
  requestTypes: many(requestType),
}));

export const oktaGroupMappingRelations = relations(oktaGroupMapping, ({ one }) => ({
  organization: one(organization, {
    fields: [oktaGroupMapping.organizationId],
    references: [organization.id],
  }),
  requestType: one(requestType, {
    fields: [oktaGroupMapping.requestTypeId],
    references: [requestType.id],
  }),
}));

export const organizationOnboardingRelations = relations(
  organizationOnboarding,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationOnboarding.organizationId],
      references: [organization.id],
    }),
  }),
);

export const organizationInviteRelations = relations(
  organizationInvite,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationInvite.organizationId],
      references: [organization.id],
    }),
    createdBy: one(user, {
      fields: [organizationInvite.createdByUserId],
      references: [user.id],
    }),
  }),
);

export const organizationEmailSettingsRelations = relations(
  organizationEmailSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationEmailSettings.organizationId],
      references: [organization.id],
    }),
  }),
);

export const connectorCredentialRelations = relations(
  connectorCredential,
  ({ one }) => ({
    organization: one(organization, {
      fields: [connectorCredential.organizationId],
      references: [organization.id],
    }),
  }),
);

export const approvalRoutingRuleRelations = relations(
  approvalRoutingRule,
  ({ one }) => ({
    organization: one(organization, {
      fields: [approvalRoutingRule.organizationId],
      references: [organization.id],
    }),
    requestType: one(requestType, {
      fields: [approvalRoutingRule.requestTypeId],
      references: [requestType.id],
    }),
    approver: one(user, {
      fields: [approvalRoutingRule.approverUserId],
      references: [user.id],
    }),
  }),
);

export const organizationRelations = relations(organization, ({ many, one }) => ({
  requestTypes: many(requestType),
  requests: many(request),
  changeTemplates: many(changeTemplate),
  changeTickets: many(changeTicket),
  auditEvents: many(auditEvent),
  apiKeys: many(apiKey),
  fulfillmentJobs: many(fulfillmentJob),
  approvalRoutingRules: many(approvalRoutingRule),
  webhookDeliveries: many(webhookDelivery),
  aiSettings: one(organizationAiSettings),
  onboarding: one(organizationOnboarding),
  invites: many(organizationInvite),
  emailSettings: one(organizationEmailSettings),
  appCatalogs: many(appCatalog),
  oktaGroupMappings: many(oktaGroupMapping),
  policyDecisionLogs: many(policyDecisionLog),
  connectorCredentials: many(connectorCredential),
  accessReviewCampaigns: many(accessReviewCampaign),
  aiUsageTelemetry: many(aiUsageTelemetry),
  roleBundles: many(roleBundle),
  intakeConversations: many(intakeConversation),
}));

export const roleBundle = pgTable(
  "role_bundle",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), 
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("role_bundle_org_name_unique").on(t.organizationId, t.name),
  ]
);

export const roleBundleRequestType = pgTable(
  "role_bundle_request_type",
  {
    id: text("id").primaryKey(),
    roleBundleId: text("role_bundle_id")
      .notNull()
      .references(() => roleBundle.id, { onDelete: "cascade" }),
    requestTypeId: text("request_type_id")
      .notNull()
      .references(() => requestType.id, { onDelete: "cascade" }),
    /** Optional JSON payload overrides for the request type when triggered by this bundle. */
    payloadOverrides: jsonb("payload_overrides").$type<Record<string, unknown>>(),
  }
);

export const roleBundleRelations = relations(roleBundle, ({ one, many }) => ({
  organization: one(organization, {
    fields: [roleBundle.organizationId],
    references: [organization.id],
  }),
  requestTypes: many(roleBundleRequestType),
}));

export const roleBundleRequestTypeRelations = relations(roleBundleRequestType, ({ one }) => ({
  roleBundle: one(roleBundle, {
    fields: [roleBundleRequestType.roleBundleId],
    references: [roleBundle.id],
  }),
  requestType: one(requestType, {
    fields: [roleBundleRequestType.requestTypeId],
    references: [requestType.id],
  }),
}));

export const aiUsageTelemetry = pgTable(
  "ai_usage_telemetry",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "set null" }),
    appId: text("app_id"), // Reference to app_catalog.id
    modelName: text("model_name").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    estimatedCostUsd: text("estimated_cost_usd").notNull().default("0"),
    budgetOwnerId: text("budget_owner_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_usage_org_idx").on(t.organizationId),
    index("ai_usage_user_idx").on(t.userId),
    index("ai_usage_created_idx").on(t.createdAt),
  ]
);

export const aiUsageTelemetryRelations = relations(aiUsageTelemetry, ({ one }) => ({
  organization: one(organization, {
    fields: [aiUsageTelemetry.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [aiUsageTelemetry.userId],
    references: [user.id],
  }),
  budgetOwner: one(user, {
    fields: [aiUsageTelemetry.budgetOwnerId],
    references: [user.id],
  }),
}));

export const changeTemplateRelations = relations(
  changeTemplate,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [changeTemplate.organizationId],
      references: [organization.id],
    }),
    tickets: many(changeTicket),
  }),
);

export const changeTicketRelations = relations(changeTicket, ({ one }) => ({
  organization: one(organization, {
    fields: [changeTicket.organizationId],
    references: [organization.id],
  }),
  template: one(changeTemplate, {
    fields: [changeTicket.changeTemplateId],
    references: [changeTemplate.id],
  }),
  requester: one(user, {
    fields: [changeTicket.requesterId],
    references: [user.id],
    relationName: "changeTicketRequester",
  }),
  assignee: one(user, {
    fields: [changeTicket.assignedUserId],
    references: [user.id],
    relationName: "changeTicketAssignee",
  }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  organization: one(organization, {
    fields: [apiKey.organizationId],
    references: [organization.id],
  }),
}));

export const requestTypeRelations = relations(requestType, ({ one, many }) => ({
  organization: one(organization, {
    fields: [requestType.organizationId],
    references: [organization.id],
  }),
  appCatalog: one(appCatalog, {
    fields: [requestType.appCatalogId],
    references: [appCatalog.id],
  }),
  requests: many(request),
  approvalRoutingRules: many(approvalRoutingRule),
  oktaGroupMappings: many(oktaGroupMapping),
}));

export const requestRelations = relations(request, ({ one, many }) => ({
  organization: one(organization, {
    fields: [request.organizationId],
    references: [organization.id],
  }),
  requestType: one(requestType, {
    fields: [request.requestTypeId],
    references: [requestType.id],
  }),
  requester: one(user, {
    fields: [request.requesterId],
    references: [user.id],
  }),
  assignee: one(user, {
    fields: [request.assignedApproverId],
    references: [user.id],
    relationName: "assignedApprover",
  }),
  approvals: many(approval),
  fulfillmentJobs: many(fulfillmentJob),
  policyDecisionLogs: many(policyDecisionLog),
}));

export const fulfillmentJobRelations = relations(fulfillmentJob, ({ one }) => ({
  organization: one(organization, {
    fields: [fulfillmentJob.organizationId],
    references: [organization.id],
  }),
  request: one(request, {
    fields: [fulfillmentJob.requestId],
    references: [request.id],
  }),
  actor: one(user, {
    fields: [fulfillmentJob.actorId],
    references: [user.id],
  }),
}));

export const approvalRelations = relations(approval, ({ one }) => ({
  request: one(request, {
    fields: [approval.requestId],
    references: [request.id],
  }),
  approver: one(user, {
    fields: [approval.approverId],
    references: [user.id],
  }),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
  organization: one(organization, {
    fields: [auditEvent.organizationId],
    references: [organization.id],
  }),
  actor: one(user, {
    fields: [auditEvent.actorId],
    references: [user.id],
  }),
}));

/** Stores individual policy engine evaluation logs for GOV-04 compliance. */
export const policyDecisionLog = pgTable("policy_decision_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  requestId: text("request_id")
    .references(() => request.id, { onDelete: "set null" }),
  requestTypeSlug: text("request_type_slug").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason"),
  policyVersion: text("policy_version"),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const policyDecisionLogRelations = relations(policyDecisionLog, ({ one }) => ({
  organization: one(organization, {
    fields: [policyDecisionLog.organizationId],
    references: [organization.id],
  }),
  request: one(request, {
    fields: [policyDecisionLog.requestId],
    references: [request.id],
  }),
  actor: one(user, {
    fields: [policyDecisionLog.actorId],
    references: [user.id],
  }),
}));

export const intakeConversation = pgTable(
  "intake_conversation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    channelUserId: text("channel_user_id").notNull(),
    channelThreadId: text("channel_thread_id"),
    resolvedUserId: text("resolved_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** FK to the request created when this conversation was confirmed. Null until confirmed. */
    resolvedRequestId: text("resolved_request_id").references(() => request.id, {
      onDelete: "set null",
    }),
    /** awaiting_clarification | awaiting_confirmation | resolved | expired */
    state: text("state").notNull(),
    detectedRequestTypeSlug: text("detected_request_type_slug"),
    detectedPayload: jsonb("detected_payload").$type<Record<string, unknown> | null>(),
    turnCount: integer("turn_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("intake_conversation_org_idx").on(t.organizationId),
    index("intake_conversation_channel_user_idx")
      .on(t.channel, t.channelUserId)
      .where(sql`${t.state} in ('awaiting_clarification', 'awaiting_confirmation')`),
    index("intake_conversation_expires_idx").on(t.expiresAt),
  ],
);

export const intakeConversationRelations = relations(intakeConversation, ({ one }) => ({
  organization: one(organization, {
    fields: [intakeConversation.organizationId],
    references: [organization.id],
  }),
  resolvedUser: one(user, {
    fields: [intakeConversation.resolvedUserId],
    references: [user.id],
  }),
  resolvedRequest: one(request, {
    fields: [intakeConversation.resolvedRequestId],
    references: [request.id],
  }),
}));
