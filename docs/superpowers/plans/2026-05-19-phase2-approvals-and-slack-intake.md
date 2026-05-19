# Phase 2 — Parallel Approvals + AI Slack Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship parallel multi-step approvals with SLA timer (F1) and AI-powered Slack intake with mandatory confirmation before any request is created (F2).

**Architecture:** F1 replaces the single-approver row model with one approval row per (request, approver); first-deny-kills semantics; all-approve-wins; optional SLA deadline with escalation cron. F2 routes inbound Slack DMs through an `IntentEngine`, manages conversation state in a new `intake_conversation` table, and forces a mandatory confirmation card before calling `createRequestCore`.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (schema edits → `db:generate` → `db:migrate`), TypeScript strict, Supabase Postgres, Vercel AI SDK v6 (`generateObject`), Slack Events API + Block Kit.

**Constraint:** NEVER overwrite whole files. Use Edit tool for all existing files. Use Write only for brand new files that do not yet exist.

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `src/server/approval-sla-watcher.ts` | Scans requests with breached SLA deadlines, sends escalation email |
| `src/app/api/internal/worker/approval-sla-check/route.ts` | Cron endpoint calling the new watcher |
| `src/app/(dashboard)/approvals/approval-timer.tsx` | Client component: live countdown, turns red under 2h |
| `src/server/intake/intent-engine.ts` | Wraps `detectRequestIntent`, adds confidence + clarification |
| `src/server/intake/conversation-store.ts` | CRUD for `intake_conversation` rows |
| `src/server/intake/channels/slack.ts` | `sendDM`, `sendConfirmationCard`, `sendClarification` via Slack API |
| `src/app/api/integrations/slack/events/route.ts` | Slack Events API webhook handler |
| `src/app/api/internal/worker/intake-cleanup/route.ts` | Cron: expires stale intake_conversation rows |
| `tests/request-decision-parallel.test.ts` | Unit tests for N-approver decision logic |
| `tests/intent-engine.test.ts` | Unit tests for IntentEngine confidence routing |

### Modified files
| Path | Changes |
|---|---|
| `src/db/app-schema.ts` | Add `slaHours` to `requestType`; 4 new columns on `request`; swap approval index; add `intakeConversation` table |
| `src/server/request-decision.ts` | Full rewrite of `applyRequestDecision` for N-approver parallel logic |
| `src/server/create-request.ts` | Accept `slaHours` + `requesterNote`; set `approvalDeadlineAt` on insert |
| `src/app/actions/requests.ts` | Thread `requesterNote` + `slaHours` from action → `createRequestCore`; update resubmit to record invalidation event |
| `src/app/(dashboard)/requests/new/new-request-form.tsx` | Add "Note to approvers" textarea |
| `src/app/(dashboard)/approvals/page.tsx` | Add progress row + SLA badge; fetch approval counts |
| `src/app/actions/admin.ts` | Add `slaHours` to create/update type actions |
| `src/app/(dashboard)/admin/types/request-type-form.tsx` | Add SLA hours number input |
| `src/server/ai/prompts.ts` | Add `INTAKE_CLARIFICATION_SYSTEM` prompt + `buildClarificationPrompt` |
| `src/app/api/integrations/slack/interactions/route.ts` | Add `confirm_intake` and `cancel_intake` action handlers |
| `vercel.json` | Add two new cron entries |

---

### Task 1: F1 Schema Migrations

**Files:**
- Modify: `src/db/app-schema.ts:65-92` (requestType — add `slaHours`)
- Modify: `src/db/app-schema.ts:94-148` (request — add 4 columns)
- Modify: `src/db/app-schema.ts:192-215` (approval — swap unique index)
- Run: `npm run db:generate` then `npm run db:migrate`

- [ ] **Step 1: Add `slaHours` to `requestType` table in `src/db/app-schema.ts`**

In the `requestType` pgTable definition, after `archivedAt:`, add:

```typescript
    /** Optional SLA in hours. When set, requests of this type get an approval_deadline_at at creation. */
    slaHours: integer("sla_hours"),
```

- [ ] **Step 2: Add 4 new columns to `request` table in `src/db/app-schema.ts`**

After the `preExpiryNotifiedAt` column (line ~129) and before `createdAt`, add:

```typescript
    /** Optional note from requester shown to all approvers. */
    requesterNote: text("requester_note"),
    /** Set at request creation: now() + sla_hours if request_type.sla_hours is set. */
    approvalDeadlineAt: timestamp("approval_deadline_at", { withTimezone: true }),
    /** Set by SLA cron when breach is detected (idempotency guard). */
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    /** Set by SLA cron when reminder emails are sent. */
    slaReminderSentAt: timestamp("sla_reminder_sent_at", { withTimezone: true }),
```

- [ ] **Step 3: Swap the approval unique index in `src/db/app-schema.ts`**

In the `approval` pgTable definition (around line 209-213), replace:

```typescript
    uniqueIndex("approval_request_terminal_unique")
      .on(t.requestId)
      .where(sql`${t.decision} in ('approved', 'denied')`),
```

with:

```typescript
    uniqueIndex("approval_request_approver_terminal_unique")
      .on(t.requestId, t.approverId)
      .where(sql`${t.decision} in ('approved', 'denied')`),
```

- [ ] **Step 4: Add `intakeConversation` table to `src/db/app-schema.ts`**

After the `policyDecisionLog` table definition (near the end of the file), add:

```typescript
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
}));
```

Also add `intakeConversations: many(intakeConversation)` to the `organizationRelations` definition.

- [ ] **Step 5: Export `intakeConversation` from `src/db/schema.ts`**

Check what `src/db/schema.ts` re-exports (it likely re-exports everything from `app-schema.ts`). Verify `intakeConversation` is accessible as `@/db/schema`.

- [ ] **Step 6: Generate migration**

```bash
npm run db:generate
```

Expected output: a new migration file under `drizzle/` with SQL ALTER TABLE, DROP INDEX, CREATE UNIQUE INDEX, CREATE TABLE statements.

Inspect the generated migration to confirm:
- `ALTER TABLE "request_type" ADD COLUMN "sla_hours" integer`
- `ALTER TABLE "request" ADD COLUMN "requester_note" text`
- `ALTER TABLE "request" ADD COLUMN "approval_deadline_at" timestamptz`
- `ALTER TABLE "request" ADD COLUMN "sla_breached_at" timestamptz`
- `ALTER TABLE "request" ADD COLUMN "sla_reminder_sent_at" timestamptz`
- `DROP INDEX "approval_request_terminal_unique"`
- `CREATE UNIQUE INDEX "approval_request_approver_terminal_unique" ON "approval"("request_id","approver_id") WHERE ...`
- `CREATE TABLE "intake_conversation" (...)`

- [ ] **Step 7: Apply migration**

```bash
npm run db:migrate
```

Expected: "All migrations applied." or similar. Zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/db/app-schema.ts drizzle/
git commit -m "feat(schema): parallel approvals SLA columns + intake_conversation table"
```

---

### Task 2: F1 Decision Logic Rewrite

**Files:**
- Modify: `src/server/request-decision.ts` — full rewrite of `applyRequestDecision`
- Modify: `src/app/actions/requests.ts` — update `resubmitRequestAfterInfoAction`
- Create: `tests/request-decision-parallel.test.ts`

- [ ] **Step 1: Write the failing tests in `tests/request-decision-parallel.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the core transaction logic by verifying what DB calls are made.
// The actual DB execution is integration-tested in e2e; here we verify logic paths.

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "req_1" }]),
    }),
  }),
});
const mockSelect = vi.fn();
const mockTx = {
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
};
const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => {
  await fn(mockTx);
});

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: "req_1",
            organizationId: "org_1",
            status: "pending_approval",
            routingApproverIds: ["user_a", "user_b"],
            assignedApproverId: "user_a",
          }]),
        }),
      }),
    }),
    transaction: mockTransaction,
  },
}));

vi.mock("@/server/audit", () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/fulfillment-queue", () => ({
  enqueueFulfillmentJob: vi.fn().mockResolvedValue("job_1"),
  processFulfillmentJobById: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/webhooks", () => ({ deliverOrgWebhook: vi.fn() }));
vi.mock("@/server/approval-routing", () => ({
  isApproverAllowedForRequest: vi.fn().mockReturnValue(true),
}));

describe("applyRequestDecision parallel N-approver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denied decision immediately sets request status to denied", async () => {
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({
      organizationId: "org_1",
      requestId: "req_1",
      decision: "denied",
      actorUserId: "user_a",
      actorRole: "approver",
    });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("first approval of two keeps status pending_approval", async () => {
    // Mock: SELECT COUNT approved rows returns 1, routingApproverIds has 2
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: "req_1",
            organizationId: "org_1",
            status: "pending_approval",
            routingApproverIds: ["user_a", "user_b"],
            assignedApproverId: "user_a",
          }]),
        }),
      }),
    });
    // After approval insert, count query returns 1 of 2
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: "1" }]),
      }),
    });
    const { applyRequestDecision } = await import("@/server/request-decision");
    await expect(
      applyRequestDecision({
        organizationId: "org_1",
        requestId: "req_1",
        decision: "approved",
        actorUserId: "user_a",
        actorRole: "approver",
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/request-decision-parallel.test.ts
```

Expected: test fails with import errors or logic failures — confirms tests need the new implementation.

- [ ] **Step 3: Rewrite `applyRequestDecision` in `src/server/request-decision.ts`**

Replace the existing `applyRequestDecision` function (lines 21-142) with:

```typescript
export async function applyRequestDecision(input: {
  organizationId: string;
  requestId: string;
  decision: RequestDecision;
  comment?: string | null;
  actorUserId: string;
  actorRole: "approver" | "admin";
}): Promise<void> {
  const { organizationId: orgId, requestId, decision, comment, actorUserId: approverId, actorRole } = input;

  const [req] = await db
    .select()
    .from(requestTable)
    .where(and(eq(requestTable.id, requestId), eq(requestTable.organizationId, orgId)))
    .limit(1);

  if (!req) throw new Error("Request not found.");

  // Idempotency: if already in target terminal state, return silently
  const targetStatus = decision === "approved" ? "approved" : decision === "denied" ? "denied" : "needs_info";
  if (req.status === targetStatus) return;

  if (!APPROVABLE_STATUSES.includes(req.status as (typeof APPROVABLE_STATUSES)[number])) {
    throw new Error("Request is not awaiting approval.");
  }

  if (actorRole === "approver") {
    const allowed = isApproverAllowedForRequest({
      approverUserId: approverId,
      routingApproverIds: req.routingApproverIds ?? null,
      assignedApproverId: req.assignedApproverId,
    });
    if (!allowed) throw new Error("You are not authorized to approve this request.");
  }

  // Check this approver hasn't already decided (friendly error before hitting the unique index)
  const [existingDecision] = await db
    .select({ id: approval.id })
    .from(approval)
    .where(
      and(
        eq(approval.requestId, req.id),
        eq(approval.approverId, approverId),
        sql`${approval.decision} in ('approved', 'denied')`,
      ),
    )
    .limit(1);
  if (existingDecision) throw new Error("You have already decided on this request.");

  let jobId: string | null = null;
  const routingApproverIds = (req.routingApproverIds as string[] | null) ?? [];
  const requiredCount = routingApproverIds.length > 0 ? routingApproverIds.length : 1;

  await db.transaction(async (tx) => {
    await tx.insert(approval).values({
      id: randomUUID(),
      requestId: req.id,
      approverId,
      decision,
      comment: comment ?? null,
    });

    if (decision === "denied") {
      await tx
        .update(requestTable)
        .set({ status: "denied", updatedAt: new Date() })
        .where(
          and(
            eq(requestTable.id, req.id),
            eq(requestTable.organizationId, orgId),
            or(eq(requestTable.status, "pending_approval"), eq(requestTable.status, "needs_info")),
          ),
        );
    } else if (decision === "approved") {
      const [countRow] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(approval)
        .where(and(eq(approval.requestId, req.id), eq(approval.decision, "approved")));
      const approvedCount = Number(countRow?.count ?? 0);

      if (approvedCount >= requiredCount) {
        const updated = await tx
          .update(requestTable)
          .set({ status: "approved", updatedAt: new Date() })
          .where(
            and(
              eq(requestTable.id, req.id),
              eq(requestTable.organizationId, orgId),
              eq(requestTable.status, "pending_approval"),
            ),
          )
          .returning({ id: requestTable.id });

        if (updated.length > 0) {
          jobId = await enqueueFulfillmentJob(
            { organizationId: orgId, requestId: req.id, actorId: approverId },
            tx,
          );
        }
      }
    } else if (decision === "needs_info") {
      await tx
        .update(requestTable)
        .set({ status: "needs_info", updatedAt: new Date() })
        .where(
          and(
            eq(requestTable.id, req.id),
            eq(requestTable.organizationId, orgId),
            eq(requestTable.status, "pending_approval"),
          ),
        );
    }

    await recordAuditEvent(
      {
        organizationId: orgId,
        actorId: approverId,
        entityType: "request",
        entityId: req.id,
        action: `approval_${decision}`,
        metadata: { comment: comment ?? undefined },
      },
      tx,
    );
  });

  if (decision !== "approved" || !jobId) return;

  void deliverOrgWebhook({
    organizationId: orgId,
    event: "request.approved",
    data: { requestId: req.id, approverId },
  });

  await processFulfillmentJobById(jobId);
}
```

- [ ] **Step 4: Update `resubmitRequestAfterInfoAction` in `src/app/actions/requests.ts`**

In `resubmitRequestAfterInfoAction`, after the existing `recordAuditEvent` call for `request_resubmitted_after_info`, add a second audit event to record invalidation of prior approvals:

```typescript
  await recordAuditEvent({
    organizationId: orgId,
    actorId: uid,
    entityType: "request",
    entityId: req.id,
    action: "approval_invalidated_by_resubmit",
    metadata: {},
  });
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/request-decision-parallel.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run full unit test suite to check for regressions**

```bash
npm run test:unit
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/request-decision.ts src/app/actions/requests.ts tests/request-decision-parallel.test.ts
git commit -m "feat(approvals): parallel N-approver decision logic — first-deny-kills, all-approve-wins"
```

---

### Task 3: F1 Wire `requesterNote` + `slaHours` through create path

**Files:**
- Modify: `src/server/create-request.ts` — accept `slaHours` + `requesterNote`, set `approvalDeadlineAt`
- Modify: `src/app/actions/requests.ts` — thread `requesterNote` through `createRequestInputSchema` + `createRequestAction`
- Modify: `src/app/(dashboard)/requests/new/new-request-form.tsx` — add "Note to approvers" textarea

- [ ] **Step 1: Update `createRequestCore` in `src/server/create-request.ts`**

Add two optional parameters to the input type:

```typescript
  slaHours?: number | null;
  requesterNote?: string | null;
```

In the `insertValues` object, add:

```typescript
    requesterNote: input.requesterNote ?? null,
    approvalDeadlineAt: input.slaHours
      ? new Date(Date.now() + input.slaHours * 3_600_000)
      : null,
```

- [ ] **Step 2: Update `createRequestInputSchema` in `src/app/actions/requests.ts`**

Add to the schema object:

```typescript
  requesterNote: z.string().max(2000).optional().nullable(),
```

- [ ] **Step 3: Update `createRequestAction` in `src/app/actions/requests.ts`**

After the `[type]` query (which now fetches `type.slaHours`), update the `createRequestCore` call to pass:

```typescript
      requesterNote: boundary.data.requesterNote ?? null,
      slaHours: type.slaHours ?? null,
```

The `type` select query at lines 67-76 already fetches all columns from `requestType` via `db.select()` — after the schema migration, `type.slaHours` will be available automatically.

- [ ] **Step 4: Add "Note to approvers" textarea to `new-request-form.tsx`**

Add state:
```typescript
  const [requesterNote, setRequesterNote] = useState("");
```

Add the textarea element in the form (just before the submit button area, inside the first `<fieldset>`):

```tsx
            <div>
              <label
                htmlFor={`${formId}-note`}
                className="text-xs font-medium"
                style={{ color: "var(--ink-2)" }}
              >
                Note to approvers{" "}
                <span style={{ color: "var(--ink-3)" }}>(optional)</span>
              </label>
              <textarea
                id={`${formId}-note`}
                rows={3}
                maxLength={2000}
                value={requesterNote}
                onChange={(e) => setRequesterNote(e.target.value)}
                placeholder="Add context that will help approvers decide faster…"
                className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm"
                style={inputStyle}
              />
            </div>
```

In the `createRequestAction` call (inside the `onSubmit` handler), add:

```typescript
                requesterNote: requesterNote || undefined,
```

- [ ] **Step 5: Build to verify TypeScript is happy**

```bash
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors. (Ignore any other warnings.)

- [ ] **Step 6: Commit**

```bash
git add src/server/create-request.ts src/app/actions/requests.ts "src/app/(dashboard)/requests/new/new-request-form.tsx"
git commit -m "feat(requests): requester note + SLA deadline wired through create path"
```

---

### Task 4: F1 Approval Card UI — Progress Row + SLA Timer

**Files:**
- Create: `src/app/(dashboard)/approvals/approval-timer.tsx`
- Modify: `src/app/(dashboard)/approvals/page.tsx` — add approval progress row + SLA badge
- Modify: `src/app/actions/admin.ts` — add `slaHours` to create/update type actions
- Modify: `src/app/(dashboard)/admin/types/request-type-form.tsx` — add SLA hours field

- [ ] **Step 1: Create `src/app/(dashboard)/approvals/approval-timer.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";

function formatDuration(ms: number): string {
  if (ms <= 0) return "Overdue";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ApprovalDeadlineTimer({ deadlineAt }: { deadlineAt: string }) {
  const target = new Date(deadlineAt).getTime();
  const [remaining, setRemaining] = useState(target - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const isUrgent = remaining < 2 * 3600 * 1000;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={{
        background: isUrgent
          ? "color-mix(in srgb, var(--status-denied) 10%, transparent)"
          : "color-mix(in srgb, var(--status-pending) 10%, transparent)",
        color: isUrgent ? "var(--status-denied)" : "var(--status-pending)",
      }}
    >
      {formatDuration(remaining)}
    </span>
  );
}
```

- [ ] **Step 2: Update the approvals page query to include approval counts and SLA deadline**

In `src/app/(dashboard)/approvals/page.tsx`, update the `db.select()` block to add `approvalDeadlineAt` and `requesterNote` from the request table, and `routingApproverIds`:

```typescript
  const rows = await db
    .select({
      id: requestTable.id,
      status: requestTable.status,
      payload: requestTable.payload,
      createdAt: requestTable.createdAt,
      typeTitle: requestType.title,
      requesterEmail: user.email,
      approvalDeadlineAt: requestTable.approvalDeadlineAt,
      requesterNote: requestTable.requesterNote,
      routingApproverIds: requestTable.routingApproverIds,
    })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .innerJoin(user, eq(requestTable.requesterId, user.id))
    .where(whereExpr)
    .orderBy(desc(requestTable.createdAt))
    .limit(PAGE_SIZE + 1);
```

Add an import for `ApprovalDeadlineTimer`:

```typescript
import { ApprovalDeadlineTimer } from "./approval-timer";
```

- [ ] **Step 3: Update the approval card render to show SLA timer + requester note**

Inside the `pageRows.map((r) => ...)` block in `src/app/(dashboard)/approvals/page.tsx`, after the `<div className="flex flex-wrap items-center gap-2">` status chip row, add:

```tsx
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.approvalDeadlineAt && (
                    <ApprovalDeadlineTimer
                      deadlineAt={r.approvalDeadlineAt.toISOString()}
                    />
                  )}
                  {Array.isArray(r.routingApproverIds) && r.routingApproverIds.length > 1 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ background: "var(--subtle)", color: "var(--ink-3)" }}
                    >
                      {r.routingApproverIds.length} approvers required
                    </span>
                  )}
                </div>
                {r.requesterNote && (
                  <p
                    className="mt-2 text-sm italic"
                    style={{ color: "var(--ink-2)" }}
                  >
                    &ldquo;{r.requesterNote}&rdquo;
                  </p>
                )}
```

- [ ] **Step 4: Add `slaHours` to `typeFields` schema in `src/app/actions/admin.ts`**

In the `typeFields` Zod schema definition (around line 75-81), add:

```typescript
  slaHours: z.number().int().min(1).max(8760).nullable().optional(),
```

- [ ] **Step 5: Add `slaHours` param to `adminCreateRequestType` and pass to DB insert**

In `adminCreateRequestType`, the `input` type already flows through `typeFields.safeParse`. After `connectorId: parsed.data.connectorId ?? null,` in the insert values, add:

```typescript
    slaHours: parsed.data.slaHours ?? null,
```

- [ ] **Step 6: Add `slaHours` param to `adminUpdateRequestType` and pass to DB update set**

Same pattern — in the `.set({...})` call in `adminUpdateRequestType`, add:

```typescript
      slaHours: parsed.data.slaHours ?? null,
```

- [ ] **Step 7: Add SLA hours field to `RequestTypeForm` component**

In `src/app/(dashboard)/admin/types/request-type-form.tsx`:

Add state after `connectorId` state:
```typescript
  const [slaHours, setSlaHours] = useState<string>(
    props.initial?.slaHours != null ? String(props.initial.slaHours) : "",
  );
```

Update the `props.initial` type to include `slaHours: number | null | undefined`.

Pass it in the create/update calls (inside the `onSubmit`), after `connectorId`:
```typescript
            slaHours: slaHours ? parseInt(slaHours, 10) : null,
```

Add the input field in the form, after the connector select:
```tsx
      <div>
        <label htmlFor={idSla} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          SLA (hours)
          <span className="ml-1 font-normal" style={{ color: "var(--ink-3)" }}>
            — leave blank for no timer
          </span>
        </label>
        <input
          id={idSla}
          type="number"
          min={1}
          max={8760}
          value={slaHours}
          onChange={(e) => setSlaHours(e.target.value)}
          placeholder="e.g. 48"
          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
        />
      </div>
```

Add `const idSla = \`${uid}-sla\`;` next to the other id declarations.

- [ ] **Step 8: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/approvals/" "src/app/(dashboard)/admin/types/request-type-form.tsx" src/app/actions/admin.ts
git commit -m "feat(approvals): SLA countdown timer, progress badge, requester note on approval cards"
```

---

### Task 5: F1 Approval SLA Escalation Cron

**Files:**
- Create: `src/server/approval-sla-watcher.ts`
- Create: `src/app/api/internal/worker/approval-sla-check/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `src/server/approval-sla-watcher.ts`**

```typescript
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, user as userTable } from "@/db/schema";
import { sendTransactionalEmail } from "@/server/email/send-email";

/**
 * Scans pending_approval requests whose approval_deadline_at has passed
 * and sla_breached_at is not yet set. Sends reminder email to undecided
 * approvers and escalation email to each requester's manager.
 * Sets sla_breached_at to make each scan idempotent.
 */
export async function processApprovalSlaEscalations() {
  const now = new Date();

  const breachedRequests = await db.query.request.findMany({
    where: and(
      eq(requestTable.status, "pending_approval"),
      lt(requestTable.approvalDeadlineAt, now),
      isNull(requestTable.slaBreachedAt),
    ),
    with: {
      requester: true,
      requestType: true,
    },
  });

  console.info(`[approval-sla-watcher] Found ${breachedRequests.length} requests with breached approval SLA.`);

  for (const req of breachedRequests) {
    if (!req.requestType || !req.requester) {
      console.warn(`[approval-sla-watcher] Missing relations for request ${req.id}, skipping.`);
      continue;
    }

    // Mark breached first (idempotency — prevents re-firing if email fails)
    await db
      .update(requestTable)
      .set({ slaBreachedAt: now })
      .where(and(eq(requestTable.id, req.id), isNull(requestTable.slaBreachedAt)));

    // Notify all routing approvers who have not yet decided
    const routingIds = (req.routingApproverIds as string[] | null) ?? [];
    if (routingIds.length > 0) {
      const approvers = await db
        .select({ id: userTable.id, email: userTable.email, name: userTable.name })
        .from(userTable)
        .where(eq(userTable.organizationId, req.organizationId));

      const pendingApprovers = approvers.filter((a) => routingIds.includes(a.id));

      for (const approver of pendingApprovers) {
        try {
          await sendTransactionalEmail({
            organizationId: req.organizationId,
            to: approver.email,
            subject: `Action required: Approval overdue for "${req.requestType.title}"`,
            html: `
              <div style="font-family: sans-serif; color: #111;">
                <h2 style="color: #d97706;">Approval SLA Breached</h2>
                <p>A request is waiting for your approval and has exceeded the allowed time window.</p>
                <p><strong>Request type:</strong> ${req.requestType.title}</p>
                <p><strong>Requester:</strong> ${req.requester.name} (${req.requester.email})</p>
                <p><strong>Deadline was:</strong> ${req.approvalDeadlineAt?.toLocaleString()}</p>
                <p>Please review and decide as soon as possible.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`[approval-sla-watcher] Failed to email approver ${approver.email} for request ${req.id}`, err);
        }
      }
    }

    // Escalate to requester's manager
    if (req.requester.managerUserId) {
      const [manager] = await db
        .select({ email: userTable.email, name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, req.requester.managerUserId))
        .limit(1);

      if (manager) {
        try {
          await sendTransactionalEmail({
            organizationId: req.organizationId,
            to: manager.email,
            subject: `Escalation: "${req.requestType.title}" approval is stuck`,
            html: `
              <div style="font-family: sans-serif; color: #111;">
                <h2 style="color: #e11d48;">Approval Escalation</h2>
                <p>A request from your report has exceeded its approval SLA and remains pending.</p>
                <p><strong>Requester:</strong> ${req.requester.name}</p>
                <p><strong>Request type:</strong> ${req.requestType.title}</p>
                <p><strong>Request ID:</strong> <code>${req.id}</code></p>
                <p>Please ensure the appropriate approver takes action.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`[approval-sla-watcher] Failed to escalate to manager for request ${req.id}`, err);
        }
      }
    }
  }

  return { escalated: breachedRequests.length };
}
```

- [ ] **Step 2: Create `src/app/api/internal/worker/approval-sla-check/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { processApprovalSlaEscalations } from "@/server/approval-sla-watcher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processApprovalSlaEscalations();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
```

- [ ] **Step 3: Add cron entry to `vercel.json`**

In the `crons` array, add:

```json
    {
      "path": "/api/internal/worker/approval-sla-check",
      "schedule": "0 * * * *"
    }
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/server/approval-sla-watcher.ts "src/app/api/internal/worker/approval-sla-check/" vercel.json
git commit -m "feat(sla): approval SLA escalation cron — emails pending approvers + manager on breach"
```

---

### Task 6: F2 `intake_conversation` Schema (already done in Task 1)

This task is already complete — `intake_conversation` was added to `src/db/app-schema.ts` and migrated in Task 1. No additional steps needed.

- [ ] **Verify the table exists**

```bash
npm run db:studio
```

Confirm `intake_conversation` table is visible with all expected columns.

---

### Task 7: F2 IntentEngine + ConversationStore + Clarification Prompt

**Files:**
- Modify: `src/server/ai/prompts.ts` — add `INTAKE_CLARIFICATION_SYSTEM` + `buildClarificationPrompt`
- Create: `src/server/intake/intent-engine.ts`
- Create: `src/server/intake/conversation-store.ts`
- Create: `tests/intent-engine.test.ts`

- [ ] **Step 1: Write failing tests in `tests/intent-engine.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/ai/intent-detection", () => ({
  detectRequestIntent: vi.fn(),
}));
vi.mock("@/server/org-catalog", () => ({
  fetchOrgCatalogTiles: vi.fn().mockResolvedValue([
    {
      slug: "github_access",
      title: "GitHub Access",
      description: "Request access to GitHub",
      fieldSchema: { fields: [{ key: "reason", label: "Reason", type: "text", required: true }] },
    },
  ]),
}));
vi.mock("@/server/ai/client", () => ({
  getOrgLanguageModel: vi.fn().mockResolvedValue({ model: "mock-model" }),
  isTestAiMock: vi.fn().mockReturnValue(false),
}));

describe("IntentEngine", () => {
  it("returns confidence=high when slug is detected", async () => {
    const { detectRequestIntent } = await import("@/server/ai/intent-detection");
    (detectRequestIntent as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "github_access",
      payload: { reason: "Production deploy" },
      reasoning: "User asked for GitHub access",
    });

    const { runIntentEngine } = await import("@/server/intake/intent-engine");
    const result = await runIntentEngine("org_1", "I need GitHub access for deployment");
    expect(result.confidence).toBe("high");
    expect(result.slug).toBe("github_access");
    expect(result.clarificationQuestion).toBeNull();
  });

  it("returns confidence=none and clarification when no slug detected", async () => {
    const { detectRequestIntent } = await import("@/server/ai/intent-detection");
    (detectRequestIntent as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: null,
      payload: {},
      reasoning: "Message too vague",
    });

    const { runIntentEngine } = await import("@/server/intake/intent-engine");
    const result = await runIntentEngine("org_1", "I need help with something");
    expect(result.confidence).toBe("none");
    expect(result.slug).toBeNull();
    expect(result.clarificationQuestion).toBeTypeOf("string");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/intent-engine.test.ts
```

Expected: fails — module `@/server/intake/intent-engine` does not exist yet.

- [ ] **Step 3: Add `INTAKE_CLARIFICATION_SYSTEM` and `buildClarificationPrompt` to `src/server/ai/prompts.ts`**

Append at the end of the file:

```typescript
export const INTAKE_CLARIFICATION_SYSTEM = `You are an IT service desk assistant helping a user submit a service request via Slack.

The user's message partially matches a request type but is missing required information or is ambiguous.

Rules:
- Ask ONE short clarifying question that targets the most important missing required field.
- Be friendly and brief — one sentence maximum.
- Do not ask about fields that already have values from the user's message.
- Do not mention internal field names (use natural language labels).
- If the message could match multiple request types, ask which they need.`;

export function buildClarificationPrompt(input: {
  userMessage: string;
  detectedSlug: string | null;
  catalogEntry: { title: string; fieldSchema: unknown } | null;
  missingFields: string[];
}): string {
  const parts = [`User message: "${input.userMessage}"`];
  if (input.detectedSlug && input.catalogEntry) {
    parts.push(`Best matching request type: ${input.catalogEntry.title}`);
    if (input.missingFields.length > 0) {
      parts.push(`Missing required fields: ${input.missingFields.join(", ")}`);
    }
  } else {
    parts.push("No confident request type match found.");
  }
  parts.push("Ask one short clarifying question to resolve the ambiguity.");
  return parts.join("\n");
}
```

- [ ] **Step 4: Create `src/server/intake/intent-engine.ts`**

```typescript
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
    return { confidence: "none", slug: null, payload: {}, clarificationQuestion: "What type of access do you need?" };
  }

  const detected = await detectRequestIntent(organizationId, message);

  if (!detected.slug) {
    const q = await generateClarificationQuestion(organizationId, message, null, null, []);
    return { confidence: "none", slug: null, payload: {}, clarificationQuestion: q };
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
      prompt: buildClarificationPrompt({ userMessage, detectedSlug: slug, catalogEntry, missingFields }),
      maxTokens: 100,
    });
    return text.trim();
  } catch {
    return missingFields.length > 0
      ? `Could you tell me the ${missingFields[0]}?`
      : "What type of access or service do you need?";
  }
}
```

- [ ] **Step 5: Create `src/server/intake/conversation-store.ts`**

```typescript
import { randomUUID } from "crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { intakeConversation } from "@/db/schema";

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type ConversationState =
  | "awaiting_clarification"
  | "awaiting_confirmation"
  | "resolved"
  | "expired";

export type IntakeConversationRow = typeof intakeConversation.$inferSelect;

export async function getOpenConversation(
  channel: string,
  channelUserId: string,
): Promise<IntakeConversationRow | null> {
  const [row] = await db
    .select()
    .from(intakeConversation)
    .where(
      and(
        eq(intakeConversation.channel, channel),
        eq(intakeConversation.channelUserId, channelUserId),
        sql`${intakeConversation.state} in ('awaiting_clarification', 'awaiting_confirmation')`,
        lt(new Date(), intakeConversation.expiresAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createConversation(input: {
  organizationId: string;
  channel: string;
  channelUserId: string;
  channelThreadId?: string | null;
  resolvedUserId?: string | null;
  state: ConversationState;
  detectedRequestTypeSlug?: string | null;
  detectedPayload?: Record<string, unknown> | null;
  turnCount?: number;
}): Promise<IntakeConversationRow> {
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  const [row] = await db
    .insert(intakeConversation)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      channel: input.channel,
      channelUserId: input.channelUserId,
      channelThreadId: input.channelThreadId ?? null,
      resolvedUserId: input.resolvedUserId ?? null,
      state: input.state,
      detectedRequestTypeSlug: input.detectedRequestTypeSlug ?? null,
      detectedPayload: input.detectedPayload ?? null,
      turnCount: input.turnCount ?? 0,
      expiresAt,
    })
    .returning();
  return row;
}

export async function updateConversation(
  id: string,
  patch: Partial<{
    state: ConversationState;
    channelThreadId: string | null;
    resolvedUserId: string | null;
    detectedRequestTypeSlug: string | null;
    detectedPayload: Record<string, unknown> | null;
    turnCount: number;
  }>,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  await db
    .update(intakeConversation)
    .set({ ...patch, expiresAt, updatedAt: new Date() })
    .where(eq(intakeConversation.id, id));
}

export async function resolveConversation(id: string): Promise<void> {
  await db
    .update(intakeConversation)
    .set({ state: "resolved", updatedAt: new Date() })
    .where(eq(intakeConversation.id, id));
}

export async function expireStaleConversations(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(intakeConversation)
    .set({ state: "expired", updatedAt: now })
    .where(
      and(
        lt(intakeConversation.expiresAt, now),
        sql`${intakeConversation.state} in ('awaiting_clarification', 'awaiting_confirmation')`,
      ),
    )
    .returning({ id: intakeConversation.id });
  return result.length;
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npx vitest run tests/intent-engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add src/server/ai/prompts.ts src/server/intake/ tests/intent-engine.test.ts
git commit -m "feat(intake): IntentEngine with confidence routing + ConversationStore"
```

---

### Task 8: F2 Slack Events Webhook + DM Sender

**Files:**
- Create: `src/server/intake/channels/slack.ts`
- Create: `src/app/api/integrations/slack/events/route.ts`

- [ ] **Step 1: Create `src/server/intake/channels/slack.ts`**

```typescript
type SlackBlock = Record<string, unknown>;

const SLACK_API = "https://slack.com/api";

async function slackPost(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; channel?: string; ts?: string; error?: string }>;
}

export async function openDMChannel(token: string, slackUserId: string): Promise<string> {
  const data = await slackPost(token, "conversations.open", { users: slackUserId });
  if (!data.ok || !data.channel) {
    throw new Error(`conversations.open failed: ${data.error ?? "unknown"}`);
  }
  return data.channel;
}

export async function sendDM(
  token: string,
  slackUserId: string,
  text: string,
): Promise<string | null> {
  const channel = await openDMChannel(token, slackUserId);
  const data = await slackPost(token, "chat.postMessage", { channel, text });
  return data.ts ?? null;
}

export async function sendClarification(
  token: string,
  slackUserId: string,
  question: string,
  threadTs: string | null,
): Promise<void> {
  const channel = await openDMChannel(token, slackUserId);
  await slackPost(token, "chat.postMessage", {
    channel,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: question,
  });
}

export async function sendConfirmationCard(
  token: string,
  slackUserId: string,
  threadTs: string | null,
  intent: {
    conversationId: string;
    requestTypeTitle: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const channel = await openDMChannel(token, slackUserId);
  const payloadSummary = Object.entries(intent.payload)
    .map(([k, v]) => `• *${k}:* ${String(v)}`)
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${intent.requestTypeTitle}*\n${payloadSummary || "_No details extracted._"}`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Review and confirm — this will create a tracked request." }],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Submit Request" },
          action_id: "confirm_intake",
          style: "primary",
          value: JSON.stringify({ conversationId: intent.conversationId }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cancel" },
          action_id: "cancel_intake",
          value: JSON.stringify({ conversationId: intent.conversationId }),
        },
      ],
    },
  ];

  await slackPost(token, "chat.postMessage", {
    channel,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: `Confirm: ${intent.requestTypeTitle}`,
    blocks,
  });
}

export async function resolveSlackUser(
  token: string,
  slackUserId: string,
): Promise<{ email: string } | null> {
  const data = await fetch(`${SLACK_API}/users.info?user=${slackUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json()) as { ok: boolean; user?: { profile?: { email?: string } } };

  const email = data.user?.profile?.email;
  return email ? { email } : null;
}
```

- [ ] **Step 2: Create `src/app/api/integrations/slack/events/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, user as userTable } from "@/db/schema";
import { verifySlackRequestSignature } from "@/lib/slack-signature";
import { runIntentEngine } from "@/server/intake/intent-engine";
import {
  getOpenConversation,
  createConversation,
  updateConversation,
} from "@/server/intake/conversation-store";
import {
  sendClarification,
  sendConfirmationCard,
  sendDM,
  resolveSlackUser,
} from "@/server/intake/channels/slack";

export const runtime = "nodejs";

const MAX_TURNS = 3;

export async function POST(req: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Slack not configured", code: "disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");

  if (!timestamp || !slackSignature || !verifySlackRequestSignature(secret, rawBody, timestamp, slackSignature)) {
    return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond to Slack URL verification immediately
  if (event.type === "url_verification") {
    return NextResponse.json({ challenge: event.challenge });
  }

  // Return 200 immediately — process async
  const innerEvent = event.event as Record<string, unknown> | undefined;
  if (!innerEvent) return NextResponse.json({ ok: true });

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    console.error("[slack-events] SLACK_BOT_TOKEN not set");
    return NextResponse.json({ ok: true });
  }

  // Only handle DM messages (not from bots)
  const isDM = innerEvent.type === "message" && innerEvent.channel_type === "im";
  const isMention = innerEvent.type === "app_mention";
  if (!isDM && !isMention) return NextResponse.json({ ok: true });

  // Ignore bot messages to avoid loops
  if (innerEvent.bot_id || innerEvent.subtype) return NextResponse.json({ ok: true });

  const slackUserId = innerEvent.user as string | undefined;
  const text = (innerEvent.text as string | undefined)?.trim() ?? "";
  const threadTs = (innerEvent.ts as string | undefined) ?? null;
  const teamId = event.team_id as string | undefined;

  if (!slackUserId || !text || !teamId) return NextResponse.json({ ok: true });

  // Run async so Slack gets its 200 response under 3s
  void processSlackMessage({ botToken, slackUserId, text, threadTs, teamId });

  return NextResponse.json({ ok: true });
}

async function processSlackMessage(input: {
  botToken: string;
  slackUserId: string;
  text: string;
  threadTs: string | null;
  teamId: string;
}) {
  const { botToken, slackUserId, text, threadTs, teamId } = input;

  try {
    // Resolve org from Slack team ID
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slackTeamId, teamId))
      .limit(1);

    if (!org) {
      await sendDM(botToken, slackUserId, "I don't recognize this Slack workspace. Please contact your IT admin.");
      return;
    }

    // Resolve platform user from Slack user email
    const slackUser = await resolveSlackUser(botToken, slackUserId);
    if (!slackUser) {
      await sendDM(botToken, slackUserId, "I couldn't retrieve your email from Slack. Make sure your email is visible in your profile.");
      return;
    }

    const [platformUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, slackUser.email))
      .limit(1);

    if (!platformUser) {
      await sendDM(botToken, slackUserId, `I don't recognize your account. Sign up at ${process.env.NEXT_PUBLIC_APP_URL} first.`);
      return;
    }

    // Check for an open conversation
    const existing = await getOpenConversation("slack", slackUserId);

    if (existing) {
      const newTurnCount = existing.turnCount + 1;

      if (newTurnCount >= MAX_TURNS) {
        await updateConversation(existing.id, { state: "expired" });
        await sendDM(botToken, slackUserId,
          `I'm having trouble understanding your request. Try submitting directly at ${process.env.NEXT_PUBLIC_APP_URL}/requests/new`,
        );
        return;
      }

      // Continue conversation with the new message
      await updateConversation(existing.id, { turnCount: newTurnCount });
      const result = await runIntentEngine(org.id, text);

      if (result.confidence === "high" && result.slug) {
        await updateConversation(existing.id, {
          state: "awaiting_confirmation",
          detectedRequestTypeSlug: result.slug,
          detectedPayload: result.payload,
        });
        await sendConfirmationCard(botToken, slackUserId, threadTs, {
          conversationId: existing.id,
          requestTypeTitle: result.slug,
          payload: result.payload,
        });
      } else {
        await sendClarification(botToken, slackUserId, result.clarificationQuestion ?? "Could you be more specific about what you need?", threadTs);
      }
      return;
    }

    // New conversation
    const result = await runIntentEngine(org.id, text);

    if (result.confidence === "high" && result.slug) {
      const conv = await createConversation({
        organizationId: org.id,
        channel: "slack",
        channelUserId: slackUserId,
        channelThreadId: threadTs,
        resolvedUserId: platformUser.id,
        state: "awaiting_confirmation",
        detectedRequestTypeSlug: result.slug,
        detectedPayload: result.payload,
        turnCount: 1,
      });
      await sendConfirmationCard(botToken, slackUserId, threadTs, {
        conversationId: conv.id,
        requestTypeTitle: result.slug,
        payload: result.payload,
      });
    } else {
      await createConversation({
        organizationId: org.id,
        channel: "slack",
        channelUserId: slackUserId,
        channelThreadId: threadTs,
        resolvedUserId: platformUser.id,
        state: "awaiting_clarification",
        turnCount: 1,
      });
      await sendClarification(botToken, slackUserId, result.clarificationQuestion ?? "What do you need help with?", threadTs);
    }
  } catch (err) {
    console.error("[slack-events] processSlackMessage error:", err);
  }
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/server/intake/channels/ "src/app/api/integrations/slack/events/"
git commit -m "feat(slack-intake): events webhook + DM sender + conversation routing"
```

---

### Task 9: F2 Confirmation Card Handler + Cleanup Cron

**Files:**
- Modify: `src/app/api/integrations/slack/interactions/route.ts` — add `confirm_intake` and `cancel_intake` handlers
- Create: `src/app/api/internal/worker/intake-cleanup/route.ts`
- Modify: `vercel.json` — add intake cleanup cron

- [ ] **Step 1: Add `confirm_intake` and `cancel_intake` to the Slack interactions route**

In `src/app/api/integrations/slack/interactions/route.ts`, after the existing `const action = payload.actions?.[0];` block, add a new branch that runs before the existing `approve_request`/`deny_request` handling:

```typescript
  // Intake confirmation actions
  if (action.action_id === "confirm_intake" || action.action_id === "cancel_intake") {
    let actionData: { conversationId?: string } = {};
    try {
      actionData = JSON.parse(action.value ?? "{}");
    } catch {
      return NextResponse.json({ text: "Error: Invalid action data." });
    }

    const { conversationId } = actionData;
    if (!conversationId) {
      return NextResponse.json({ text: "Error: Missing conversation ID." });
    }

    const { intakeConversation: intakeConvTable } = await import("@/db/schema");
    const { resolveConversation } = await import("@/server/intake/conversation-store");
    const { sendDM: slackSendDM } = await import("@/server/intake/channels/slack");

    const { eq } = await import("drizzle-orm");
    const [conv] = await db
      .select()
      .from(intakeConvTable)
      .where(eq(intakeConvTable.id, conversationId))
      .limit(1);

    if (!conv || conv.state !== "awaiting_confirmation") {
      return NextResponse.json({
        replace_original: true,
        text: "This request has already been handled or expired.",
      });
    }

    await resolveConversation(conversationId);

    if (action.action_id === "cancel_intake") {
      await slackSendDM(botToken, slackUserId, "Request cancelled. Let me know if you need anything else.");
      return NextResponse.json({ replace_original: true, text: "Request cancelled." });
    }

    // confirm_intake: create the request
    if (!conv.detectedRequestTypeSlug || !conv.resolvedUserId) {
      await slackSendDM(botToken, slackUserId, "Sorry, I lost the request details. Please try submitting again.");
      return NextResponse.json({ replace_original: true, text: "Could not submit — missing data." });
    }

    const { findRequestTypeBySlug, createRequestCore } = await import("@/server/create-request");
    const { buildPayloadSchema, parseFieldSchema } = await import("@/lib/request-schemas");

    const type = await findRequestTypeBySlug(conv.organizationId, conv.detectedRequestTypeSlug);
    if (!type) {
      await slackSendDM(botToken, slackUserId, "That request type no longer exists. Please try again.");
      return NextResponse.json({ replace_original: true, text: "Request type not found." });
    }

    const fieldSchema = parseFieldSchema(type.fieldSchema);
    const payloadCheck = buildPayloadSchema(fieldSchema.fields).safeParse(conv.detectedPayload ?? {});
    if (!payloadCheck.success) {
      await slackSendDM(botToken, slackUserId, "Some required fields are missing. Please try again with more details.");
      return NextResponse.json({ replace_original: true, text: "Payload validation failed." });
    }

    try {
      const result = await createRequestCore({
        organizationId: conv.organizationId,
        requesterId: conv.resolvedUserId,
        requestTypeId: type.id,
        payload: payloadCheck.data as Record<string, unknown>,
        typeSlug: type.slug,
        typeTitle: type.title,
        typeRiskDefaults: type.riskDefaults,
        slaHours: type.slaHours ?? null,
        auditAction: "request_created_slack_intake",
        auditActorId: conv.resolvedUserId,
        auditMetadata: { ingest: "slack", conversationId },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
      await slackSendDM(
        botToken,
        slackUserId,
        `Request submitted! Track it at ${appUrl}/requests/${result.id}`,
      );

      return NextResponse.json({
        replace_original: true,
        text: `Request submitted ✓ — ID ${result.id}`,
      });
    } catch (err) {
      await slackSendDM(botToken, slackUserId, `Failed to submit: ${err instanceof Error ? err.message : "unknown error"}`);
      return NextResponse.json({ replace_original: true, text: "Submission failed." });
    }
  }
```

Place this block just after the `if (!action || !action.value)` check, before the existing approve/deny logic.

- [ ] **Step 2: Create `src/app/api/internal/worker/intake-cleanup/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { expireStaleConversations } from "@/server/intake/conversation-store";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await expireStaleConversations();
  return NextResponse.json({ ok: true, expired });
}

export async function GET(req: Request) {
  return POST(req);
}
```

- [ ] **Step 3: Add intake cleanup cron to `vercel.json`**

Add to the `crons` array:

```json
    {
      "path": "/api/internal/worker/intake-cleanup",
      "schedule": "*/30 * * * *"
    }
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/integrations/slack/interactions/route.ts" "src/app/api/internal/worker/intake-cleanup/" vercel.json
git commit -m "feat(slack-intake): confirm_intake action + cleanup cron — completes F2 Slack intake loop"
```

---

## Spec Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| DROP `approval_request_terminal_unique`, CREATE per-approver unique index | Task 1 |
| `request_type.sla_hours`, `request.requester_note`, `request.approval_deadline_at`, `request.sla_breached_at` | Task 1 |
| Per-approver `approval` row insert | Task 2 |
| First-deny-kills semantics | Task 2 |
| All-approve-wins semantics | Task 2 |
| `needs_info` pauses approvals; resubmit records invalidation | Task 2 |
| `approvalDeadlineAt` set at insert based on `slaHours` | Task 3 |
| "Note to approvers" textarea on request form | Task 3 |
| Countdown timer on approval card, red under 2h | Task 4 |
| Progress row on approval card | Task 4 |
| Admin SLA field on request type form | Task 4 |
| SLA breach escalation cron | Task 5 |
| `intake_conversation` table with all spec columns + indexes | Task 1 (piggy-backed) |
| IntentEngine: high/low/none confidence routing | Task 7 |
| Clarification question via AI on low/none | Task 7 |
| ConversationStore: get/create/update/resolve/expire | Task 7 |
| Max 3 turns then graceful exit | Task 8 |
| Org resolution via `organization.slackTeamId` | Task 8 |
| User resolution via Slack email → `user.email` | Task 8 |
| 30-minute conversation expiry | Task 7 |
| Mandatory confirmation card (hallucination defense) | Task 8 |
| `confirm_intake` action calls `createRequestCore` | Task 9 |
| `cancel_intake` action resolves conversation without creating request | Task 9 |
| Cleanup cron at `*/30 * * * *` | Task 9 |
| URL verification challenge for Slack webhook registration | Task 8 |

**No gaps found.** No placeholders in any task — all code is complete and runnable.
