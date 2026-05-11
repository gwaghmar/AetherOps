@AGENTS.md

---

# Project Status — AetherOps (AI Service Now Vision)

## What This Is

ServiceNow-style operations platform for AI-native companies. Manages service requests end-to-end: intake → policy check → approval → fulfillment → audit. Multi-tenant, multi-channel (dashboard, REST API, Slack, chat ingest). Deployed on Vercel + Supabase Postgres.

Production URL: https://aetherops.vercel.app (project: `aetherops`, team: `govw`)

## Tech Stack Snapshot

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2 + React 19, App Router |
| Auth | Better Auth 1.5 |
| DB | Drizzle ORM + Supabase Postgres |
| AI | Vercel AI SDK — multi-provider routing |
| Email | Resend |
| Deploy | Vercel (Hobby — daily cron limit) |
| Billing | Stripe (wired, not fully activated) |

## AI Routing (multi-provider, tier-based)

File: `src/server/ai/client.ts`

Provider priority: OpenAI → Anthropic → Google → OpenRouter (first configured env key wins). Org BYOK overrides all platform keys.

| Tier | Use | Google model | Anthropic model | OpenAI model |
|---|---|---|---|---|
| fast | triage/classify | gemini-2.0-flash | claude-haiku-4-5-20251001 | gpt-4o-mini |
| standard | home chat | gemini-2.5-pro | claude-sonnet-4-6 | gpt-4o |
| heavy | admin chat | gemini-2.5-pro | claude-opus-4-7 | gpt-4o |

Currently active provider: **Google** (`AI_GOOGLE_API_KEY` set in Vercel + `.env.local`).
To switch: comment Google key, uncomment desired provider key in both places.

Env vars in Vercel prod:
- `AI_GOOGLE_API_KEY` ✓
- `ALLOW_AI_PLATFORM_FALLBACK=true` ✓

## Design Token System

All UI colors use CSS variables — no hardcoded Tailwind color classes allowed.

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
| `var(--status-approved)` | Green status |
| `var(--status-denied)` | Red status |
| `var(--status-pending)` | Amber status |
| `var(--ink-on-accent)` | Text on accent backgrounds |

Tinted backgrounds: `color-mix(in srgb, var(--token) 10%, transparent)`
Input backgrounds: `style={{ background: "var(--surface)" }}`

## What's Done

- [x] Core request lifecycle (create → approve → fulfill → audit)
- [x] Multi-tenant RBAC (admin / approver / requester)
- [x] AI triage (risk classify, auto-approve low-risk)
- [x] Home copilot + admin catalog copilot (streaming chat)
- [x] Multi-provider AI routing with tier-based model selection
- [x] Resend email (approval notifications, signed approve/decline links)
- [x] Access reviews + role bundles
- [x] SSO form, vault form, app registry
- [x] Stripe billing wiring
- [x] Slack interactions endpoint
- [x] Rate limiting (IP + API key, in-memory per server)
- [x] Audit PDF export
- [x] Full UI token sweep (zero hardcoded color classes)
- [x] Magic UI / YC theme on login + dashboard
- [x] Vercel prod deploy with Supabase cloud DB

## Pending / To-Do

### Immediate (blockers for first real use)
- [ ] **Create first admin account** — sign up at production URL, then set `role = 'admin'` in Supabase `user` table for that user
- [ ] **Disable Supabase email confirmation** — Supabase dashboard → Auth → Email → disable "Confirm email" for dev/demo
- [ ] **Seed demo org data** — run `npm run db:seed` against prod DB or manually insert catalog items via admin UI

### Infrastructure
- [ ] **Custom domain** — Vercel project settings → Domains → add your domain (e.g. `app.grantops.ai`)
- [ ] **Rename Vercel project** — currently `aetherops`, rename to `grantops` in Vercel project settings if desired
- [ ] **Stripe activation** — complete Stripe account setup and enable live mode keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Vercel env)
- [ ] **Upgrade Vercel plan** — Hobby limits cron to once daily; Pro unlocks per-minute crons for fulfillment worker

### Product / Features
- [ ] **Slack integration** — set `SLACK_SIGNING_SECRET` in Vercel env to enable interactive Slack approvals
- [ ] **Webhook connector** — set `PROVISION_CONNECTOR=http_webhook` + `PROVISION_WEBHOOK_URL` to route fulfillment to real automation
- [ ] **Middleware deprecation warning** — Next.js 16 warns `middleware` convention is deprecated; rename `src/middleware.ts` → `src/proxy.ts` when ready
- [ ] **OpenRouter as fallback** — add `AI_OPENROUTER_API_KEY` in Vercel env to get automatic failover if Google is down
- [ ] **Per-org AI keys** — admin UI at `/admin/ai` lets orgs bring their own OpenAI-compatible key (BYOK already wired in backend)

### Code Quality
- [ ] E2E tests (`e2e/`) are scaffolded but not covering all new flows — extend Playwright specs for access reviews, vault, SSO
- [ ] Unit test coverage for AI triage edge cases

## Key Env Vars (Vercel Production)

| Var | Status | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ set | Supabase direct connection |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ set | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ set | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ set | |
| `AI_GOOGLE_API_KEY` | ✓ set | Active AI provider |
| `ALLOW_AI_PLATFORM_FALLBACK` | ✓ set | Must be `true` in prod |
| `RESEND_API_KEY` | ✓ set | |
| `EMAIL_FROM` | ✓ set | |
| `DEFAULT_ORGANIZATION_ID` | ✓ set | `org_demo` |
| `API_KEY_PEPPER` | ✓ set | |
| `FIELD_ENCRYPTION_KEY` | ✓ set | |
| `CRON_SECRET` | ✓ set | |
| `STRIPE_SECRET_KEY` | not set | Needed for billing |
| `STRIPE_WEBHOOK_SECRET` | not set | Needed for billing |
| `SLACK_SIGNING_SECRET` | not set | Needed for Slack approvals |
| `PROVISION_WEBHOOK_URL` | not set | Needed for real fulfillment |

## Common Commands

```bash
npm run dev              # dev server :3000
npm run build            # production build + type check
npm run lint             # ESLint
npm run db:migrate       # apply migrations
npm run db:seed          # seed demo data
npm run db:push          # push schema to DB (dev)
```
