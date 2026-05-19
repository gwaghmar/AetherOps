# Phase 2 — Parallel Approvals + AI Slack Intake

## Overview

Two independent features that together make AetherOps credible for a 50-person company:

1. **Parallel multi-step approvals with timer** — all approvers notified at once, visible countdown, auto-escalate on breach
2. **AI Slack intake** — user messages the bot in natural language, bot clarifies if needed, confirms before creating request

Build order: F1 first (lower risk, no external integrations), then F2.

---

## Feature 1: Parallel Multi-Step Approvals with Timer

### What changes

**Current model:** One approval row per request. One assigned approver. No deadline. No requester note.

**New model:** One approval row per (request, approver). Request moves to `approved` only when all assigned approvers have approved. First deny kills the request immediately. Optional deadline per request type. Requester can add a note visible to all approvers.

### Schema migrations

**Migration 1 — `request_type` and `request` additions:**
```sql
ALTER TABLE request_type ADD COLUMN sla_hours integer;

ALTER TABLE request
  ADD COLUMN requester_note text,
  ADD COLUMN approval_deadline_at timestamptz,
  ADD COLUMN sla_breached_at timestamptz,
  ADD COLUMN sla_reminder_sent_at timestamptz;
```

**Migration 2 — approval table index swap:**
```sql
-- Drop the existing one-terminal-decision-per-request constraint
DROP INDEX approval_request_terminal_unique;

-- Replace: one terminal decision per (request, approver)
CREATE UNIQUE INDEX approval_request_approver_terminal_unique
  ON approval(request_id, approver_id)
  WHERE decision IN ('approved', 'denied');
```

No new tables. `managerUserId` already exists on `user` — escalation path is unblocked.

### Request submission

- New optional **"Note to approvers"** textarea on the request form
- Stored as `request.requesterNote`
- Shown on every approver's approval card and in email notifications
- `approval_deadline_at` computed at insert: `now() + interval '? hours'` if `request_type.sla_hours` is set, else null

### Approval decision logic (`src/server/request-decision.ts`)

Replace single-update logic with per-approver logic:

1. Insert per-approver `approval` row (unique on `request_id, approver_id` with `decision IN (approved, denied)`)
2. If `decision === "denied"` → set `request.status = "denied"` immediately (first-deny-kills)
3. If `decision === "approved"` → count approved rows for this request; if `count === routingApproverIds.length` → set `request.status = "approved"` and enqueue fulfillment; else keep `status = "pending_approval"`
4. All status transitions guarded by `WHERE status = 'pending_approval'` predicate — handles concurrent approvals safely
5. `needs_info` semantics: setting needs_info pauses all approvals. On resubmit, all existing `approved` rows are invalidated via audit event `approval_invalidated_by_resubmit` (rows kept, not deleted)

### Approval card UI

- Shows: requester name, request type, requester note, countdown timer
- Timer: client-side, ticks every second, turns red when under 2 hours remaining
- Progress row: "2 of 3 approved — waiting on Sarah, James"
- Approve/Deny buttons disabled if this approver already decided
- Works on dashboard and in email (email shows static deadline time, no live timer)

### Escalation cron

Extends `src/server/sla-watcher.ts` (or new `src/server/approval-sla-watcher.ts`):

- Scans: `WHERE status = 'pending_approval' AND approval_deadline_at < now() AND sla_breached_at IS NULL`
- For each: send reminder email to each approver who has not yet decided + send "stuck" email to `requester.managerUserId`
- Set `sla_breached_at = now()` to make idempotent (won't fire again for same request)
- Add to `vercel.json` cron schedule alongside existing SLA check

### Admin setup

- Request type form gets a new optional **"SLA (hours)"** number field
- Blank = no timer
- Shown in admin at `/admin/types`

### Edge cases

- **Concurrent approvals:** two approvers click simultaneously → per-approver unique index deduplicates; status flip guarded by predicate update
- **Email link after deny:** clicking an email approve/deny link after another approver already denied → idempotency check returns clear "request already resolved" message
- **Email tokens:** each approver already gets a unique JWT per notification — works unchanged with N approvers

---

## Feature 2: AI Slack Intake

### What it does

User DMs the Slack bot or @mentions it. Bot:
1. Moves conversation to DM (never replies with sensitive info in public channels)
2. Detects intent via `IntentEngine`
3. If confident: sends confirmation card showing detected request type + extracted fields → user clicks **Submit** → `createRequestCore` called
4. If unclear: asks one short clarification question → user replies → loop (max 3 turns)
5. After 3 turns with no confident match: graceful exit ("I'm not sure what you need — try submitting at [dashboard URL]")
6. Conversations expire after 30 minutes of inactivity

Hallucination defense: **confirmation card is mandatory**. No request is ever auto-created from a single message. User must explicitly click Submit.

### New DB table

```sql
CREATE TABLE intake_conversation (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  channel text NOT NULL,                      -- 'slack' for now
  channel_user_id text NOT NULL,              -- Slack user id
  channel_thread_id text,                     -- message ts for threading replies
  resolved_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  state text NOT NULL,                        -- awaiting_clarification | awaiting_confirmation | resolved | expired
  detected_request_type_slug text,
  detected_payload jsonb,
  turn_count integer NOT NULL DEFAULT 0,      -- max 3 before graceful exit
  expires_at timestamptz NOT NULL,            -- now() + 30 min, reset on each turn
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_conversation_channel_user_idx
  ON intake_conversation(channel, channel_user_id)
  WHERE state IN ('awaiting_clarification', 'awaiting_confirmation');

CREATE INDEX intake_conversation_expires_idx
  ON intake_conversation(expires_at);
```

### New files

| File | Responsibility |
|---|---|
| `src/server/intake/intent-engine.ts` | Wraps existing `detectRequestIntent`. Returns `{ slug, payload, confidence: 'high' \| 'low' \| 'none', clarificationQuestion: string \| null }`. Uses `fast` tier model. Includes required fields hint in prompt. |
| `src/server/intake/conversation-store.ts` | `getOpenConversation(channel, channelUserId)`, `upsertConversation(...)`, `resolveConversation(id)`, `expireStale()` |
| `src/server/intake/channels/slack.ts` | `sendDM(userId, text)`, `sendConfirmationCard(userId, threadTs, intent)`, `sendClarification(userId, threadTs, question)` — uses existing `SLACK_BOT_TOKEN` |
| `src/app/api/integrations/slack/events/route.ts` | **New** — Slack Events API webhook. Handles `message.im` and `app_mention`. Verifies Slack signature. Dispatches to IntentEngine. Returns 200 immediately (async processing). |
| cleanup in `interactions/route.ts` | Add `confirm_intake` action handler — pulls conversation row, calls `createRequestCore`, posts confirmation DM |
| `src/app/api/internal/worker/intake-cleanup/route.ts` | **New** — expires stale conversations. Added to vercel.json cron. |

### Modified files

| File | Change |
|---|---|
| `src/server/ai/prompts.ts` | Add `INTAKE_CLARIFICATION_SYSTEM` prompt: given a user message + candidate request type, return one short clarifying question targeting missing required fields |
| `src/app/api/v1/ingest/chat/route.ts` | Refactor to use new `IntentEngine`. Returns clarification question when confidence is low instead of 422. |

### Conversation flow states

```
[new message]
     │
     ▼
IntentEngine
     │
confidence=high ──────────────────► send confirmation card
     │                                      │
confidence=low                        user clicks Submit
     │                                      │
     ▼                               createRequestCore()
send clarification question                 │
     │                                      ▼
user replies                         "Request submitted ✓"
     │
turn_count < 3
     │
     └── loop back to IntentEngine

turn_count = 3
     │
     ▼
graceful exit + dashboard link
```

### Org + user resolution

- Org: resolved from `organization.slackTeamId` (already stored)
- User: looked up by Slack `userId` → search `user.email` via Slack `users.info` API call; cache result in `intake_conversation.resolved_user_id`
- If user not found in org: bot replies "I don't recognize your account — sign up at [URL] first"

### Rate limiting

- Reuse existing per-org rate limit pattern from `src/server/ai/request-guard.ts`
- 20 intake messages per user per hour

### Cron

Add to `vercel.json`:
```json
{ "path": "/api/internal/worker/intake-cleanup", "schedule": "*/30 * * * *" }
```

---

## What is NOT in Phase 2

- Microsoft Teams — Phase 3
- Google Chat — Phase 3
- Inbound email — Phase 3
- Visual form builder — separate spec
- In-app notification bell — separate spec

---

## Build Order

1. **F1 schema migrations** — no external dependencies, safe to run first
2. **F1 decision logic rewrite** — `request-decision.ts`, server-only
3. **F1 UI** — approval card timer, progress row, requester note field
4. **F1 escalation cron** — extends existing sla-watcher pattern
5. **F2 `intake_conversation` table** — independent migration
6. **F2 IntentEngine + ConversationStore** — server-only, no Slack yet
7. **F2 Slack events webhook + DM responder** — needs Slack app config
8. **F2 Confirmation card + `confirm_intake` action** — completes the loop
9. **F2 Cleanup cron** — last, low risk

---

## Risks

| Risk | Mitigation |
|---|---|
| Concurrent approval race | `WHERE status='pending_approval'` predicate on every status update |
| AI hallucination | Mandatory confirmation card — never auto-submit |
| Vercel Hobby cron (once/day limit) | Upgrade to Pro OR use GitHub Actions as hourly cron trigger |
| `needs_info` + parallel approvals conflict | Invalidate prior approvals on resubmit via audit event |
