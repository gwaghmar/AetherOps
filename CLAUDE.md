# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

# Project Status — AetherOps (AI Service Now Vision)

## What This Is

ServiceNow-style operations platform for AI-native companies. Manages service requests end-to-end: intake → policy check → approval → fulfillment → audit. Multi-tenant, multi-channel (dashboard, REST API, Slack, chat ingest). Deployed on Vercel + Supabase Postgres.

**Real production URL: `https://aetherops-govw.vercel.app`** (project: `aetherops`, team: `govw`)
Note: `aetherops.vercel.app` does NOT exist — always use `aetherops-govw.vercel.app`.

## Auth Stack

Auth is **Supabase Auth** (`@supabase/ssr`). AGENTS.md references Better Auth — that was removed.

| File | Role |
|---|---|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client (reads cookies) |
| `src/lib/session.ts` | `getSession()` / `requireSession()` / `requireRole()` — reads Supabase auth user + queries `user` table for role/profile |
| `src/middleware.ts` | Refreshes Supabase session on every request (must not contain custom logic between `createServerClient` and `getUser`) |
| `src/app/api/auth/callback/route.ts` | OAuth / email-link callback — creates user profile row |
| `src/app/actions/auth.ts` | `ensureUserProfileAction` — called after direct sign-up to create profile row |

First user to sign up automatically gets `admin` role (handled in `ensureUserProfileAction`).

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2 + React 19, App Router |
| Auth | Supabase Auth (`@supabase/ssr`) |
| DB | Drizzle ORM + Supabase Postgres |
| AI | Vercel AI SDK v6 — multi-provider routing (`src/server/ai/client.ts`) |
| Email | Resend |
| Deploy | Vercel Hobby — daily cron limit applies |
| Billing | Stripe (wired, not fully activated) |

## Commands

```bash
npm run dev              # dev server :3000
npm run build            # production build + type check
npm run lint             # ESLint

# DB
npm run db:generate      # generate migration files from schema changes
npm run db:migrate       # apply pending migrations to DB
npm run db:push          # push schema directly to DB (dev/staging only)
npm run db:studio        # open Drizzle Studio GUI
npm run db:seed          # seed demo data

# Tests
npm run test:unit        # run all Vitest unit tests
npm run test:e2e         # run all Playwright e2e tests
npx vitest run tests/request-schemas.test.ts  # run single unit test file
npx playwright test e2e/governance-flow.spec.ts  # run single e2e spec

# Vercel / prod
vercel env ls
vercel logs --environment production --limit 50
vercel deploy --prod --yes
```

## Architecture

### Layer map

```
src/app/(dashboard)/**    — server components + client subcomponents; auth-gated
src/app/sign-in|sign-up   — auth pages
src/app/api/**            — HTTP endpoints (v1 REST, webhooks, cron workers, admin export)
src/app/actions/**        — "use server" mutations; validate → delegate to src/server/**
src/server/**             — domain/service layer (request lifecycle, AI, email, connectors)
src/db/**                 — Drizzle schema + shared pg connection
src/lib/**                — utilities, env, auth helpers
```

### Request lifecycle

`createRequestCore` (`src/server/create-request.ts`) is the single entry point for all request creation regardless of caller (dashboard form, v1 API, chat ingest). It:
1. Calls `evaluatePolicyOrThrow` (optional external OPA-style sidecar via `POLICY_ENGINE_URL`)
2. Resolves approvers via `resolveApproverUserIds`
3. Inserts the `request` row (idempotency key deduplication on `23505`)
4. Records an audit event
5. Fires notifications and org webhooks (fire-and-forget)
6. Triggers async AI triage

### Approval → fulfillment pipeline

`src/server/request-decision.ts` handles approve/deny transitions. On approval it calls `enqueueFulfillmentJob` which writes a `fulfillment_job` row. The cron worker at `src/app/api/internal/worker/fulfillment/route.ts` picks up pending jobs and calls the active connector via `getConnector()` (`src/server/connectors/registry.ts`).

**Available connectors** (selected by `connectorId` on `request_type` or `PROVISION_CONNECTOR` env): `stub` (dev), `log`, `http_webhook`, `manual_ticketing`, `github`, `google_workspace`, `aws`, `slack`, `linear`, `vercel`, `openai`, `notion`, `stripe`.

### AI routing

`getOrgLanguageModel(orgId, tier)` in `src/server/ai/client.ts`:
1. Org BYOK key in `organization_ai_settings` (OpenAI-compatible, encrypted with `FIELD_ENCRYPTION_KEY`)
2. Platform provider chain — first configured env key wins: `AI_OPENAI_API_KEY` → `AI_ANTHROPIC_API_KEY` → `AI_GOOGLE_API_KEY` → `AI_OPENROUTER_API_KEY`

| Tier | Use case | Google | Anthropic | OpenAI |
|---|---|---|---|---|
| `fast` | triage/classify | gemini-2.0-flash | claude-haiku-4-5-20251001 | gpt-4o-mini |
| `standard` | home chat | gemini-2.5-pro | claude-sonnet-4-6 | gpt-4o |
| `heavy` | admin chat | gemini-2.5-pro | claude-opus-4-7 | gpt-4o |

Currently active provider: **Google** (`AI_GOOGLE_API_KEY` set).

### DB schema (key tables)

`organization`, `user` (auth-schema), `request_type`, `request`, `approval`, `fulfillment_job`, `approval_routing_rule`, `audit_event`, `webhook_delivery`, `connector_credential` (encrypted vault), `change_ticket`, `access_review_campaign`, `role_bundle`, `ai_usage_telemetry`, `policy_decision_log`.

All tables are org-scoped. The `audit_event` table is append-only — never UPDATE or DELETE from it.

### Design token system

All UI colors use CSS variables — no hardcoded Tailwind color classes in `src/`.

| Token | Purpose |
|---|---|
| `var(--canvas)` | Page background |
| `var(--surface)` | Card/panel background |
| `var(--subtle)` | Muted section background |
| `var(--ink)` | Primary text |
| `var(--ink-2)` | Secondary text |
| `var(--ink-3)` | Tertiary/placeholder text |
| `var(--accent)` | Brand color (buttons, links) |
| `var(--line)` | Borders/dividers |
| `var(--status-approved)` | Green |
| `var(--status-denied)` | Red |
| `var(--status-pending)` | Amber |
| `var(--ink-on-accent)` | Text on accent backgrounds |

Tinted backgrounds: `color-mix(in srgb, var(--token) 10%, transparent)`
Input backgrounds: `style={{ background: "var(--surface)" }}`

## Key Env Vars (Vercel Production)

| Var | Status | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ | Supabase direct connection |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | |
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://aetherops-govw.vercel.app` |
| `AI_GOOGLE_API_KEY` | ✓ | Active AI provider |
| `ALLOW_AI_PLATFORM_FALLBACK` | ✓ | `true` |
| `ALLOW_STUB_PROVISION` | ✓ | `true` (needed until real connector activated) |
| `RESEND_API_KEY` | ✓ | |
| `DEFAULT_ORGANIZATION_ID` | ✓ | `org_demo` |
| `API_KEY_PEPPER` | ✓ | |
| `FIELD_ENCRYPTION_KEY` | ✓ | 32-byte base64 — required for connector vault + BYOK |
| `CRON_SECRET` | ✓ | |
| `EMAIL_FROM` | ? | Verify it's set in Vercel (was only confirmed in `.env.local`) |
| `STRIPE_SECRET_KEY` | ✗ | Needed for billing |
| `STRIPE_WEBHOOK_SECRET` | ✗ | Needed for billing |
| `SLACK_SIGNING_SECRET` | ✗ | Needed for Slack approvals |
| `PROVISION_WEBHOOK_URL` | ✗ | Required when `PROVISION_CONNECTOR=http_webhook` |
| `POLICY_ENGINE_URL` | ✗ | Optional OPA-style external policy sidecar |

## Active Bug — Sign-up "Failed to Fetch" (NOT fully resolved)

Sign-up at `https://aetherops-govw.vercel.app/sign-up` was returning "Failed to fetch".

**Root causes found and fixed:**
1. `emailRedirectTo` in sign-up form was hitting Supabase URL whitelist → removed
2. User profile row not created on auto-confirmed sign-up → fixed via `ensureUserProfileAction`
3. Supabase Site URL was localhost → updated to prod URL
4. `NEXT_PUBLIC_APP_URL` was localhost → updated in Vercel env

**Still untested.** If it still fails, check in order:
1. Browser devtools → Network tab → find the failing request
2. `vercel logs --environment production --limit 50`
3. Confirm Supabase Site URL and Redirect URLs are saved correctly

## Pending / To-Do

### Critical
- [ ] **Complete sign-up flow** — not successfully tested yet
- [ ] **First user = admin** — `ensureUserProfileAction` auto-grants admin to first signup

### Infrastructure
- [ ] **Custom domain** — Vercel → Domains; update Supabase Site URL + Redirect URLs + `NEXT_PUBLIC_APP_URL`
- [ ] **Stripe activation** — add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- [ ] **Upgrade Vercel plan** — Hobby limits cron to once daily

### Product
- [ ] **Slack integration** — add `SLACK_SIGNING_SECRET`
- [ ] **Webhook fulfillment** — set `PROVISION_CONNECTOR=http_webhook` + `PROVISION_WEBHOOK_URL`
- [ ] **OpenRouter fallback** — add `AI_OPENROUTER_API_KEY`
- [ ] **Middleware rename** — Next.js 16 deprecates `middleware`; rename `src/middleware.ts` → `src/proxy.ts`

### Code Quality
- [ ] E2E tests for access reviews, vault, SSO flows
- [ ] Unit tests for AI triage edge cases

## Supabase MCP

Supabase MCP server added via `.claude.json` (local, not committed). Available in sessions that load it.

Note: the management token (`sbp_ead6...`) belongs to a different Supabase account — shows CodeBuddy AI and Carbon tracker projects, NOT `lbqrgvqmurshifvttavg`. Log into the correct Supabase account to generate a new token if management API access is needed.
