@AGENTS.md

---

# Project Status — AetherOps (AI Service Now Vision)

## What This Is

ServiceNow-style operations platform for AI-native companies. Manages service requests end-to-end: intake → policy check → approval → fulfillment → audit. Multi-tenant, multi-channel (dashboard, REST API, Slack, chat ingest). Deployed on Vercel + Supabase Postgres.

**Real production URL: `https://aetherops-govw.vercel.app`** (project: `aetherops`, team: `govw`)
Note: `aetherops.vercel.app` does NOT exist — always use `aetherops-govw.vercel.app`.

## Auth Stack (important — AGENTS.md is wrong)

Auth is **Supabase Auth** (`@supabase/ssr`), NOT Better Auth. Better Auth was removed.
- Client: `src/lib/supabase/client.ts`
- Server: `src/lib/supabase/server.ts`
- Session layer: `src/lib/session.ts` (reads Supabase auth user + queries `user` table for profile/role)
- Middleware: `src/middleware.ts` (refreshes Supabase session on every request)
- Auth callback: `src/app/api/auth/callback/route.ts` (OAuth/email-link flow — creates user profile row)
- Sign-up action: `src/app/actions/auth.ts` → `ensureUserProfileAction` (called after direct sign-up to create profile row)

## Tech Stack Snapshot

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2 + React 19, App Router |
| Auth | Supabase Auth (`@supabase/ssr`) |
| DB | Drizzle ORM + Supabase Postgres |
| AI | Vercel AI SDK — multi-provider routing |
| Email | Resend |
| Deploy | Vercel Hobby — daily cron limit applies |
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
To switch: remove Google key, add desired provider key in Vercel env vars.

## Design Token System

All UI colors use CSS variables — no hardcoded Tailwind color classes anywhere in src/.

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
- [x] Multi-provider AI routing with tier-based model selection (gemini-2.5-pro for standard/heavy)
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
- [x] Supabase MCP server added to Claude Code local config (`.claude.json`) — available next session
- [x] Sign-up form fixed: `ensureUserProfileAction` creates profile row after auto-confirmed sign-up
- [x] Supabase email confirmation disabled (done in dashboard)
- [x] Supabase Site URL set to `https://aetherops-govw.vercel.app`
- [x] Supabase Redirect URLs: `https://aetherops-govw.vercel.app/**` added
- [x] `NEXT_PUBLIC_APP_URL` updated to `https://aetherops-govw.vercel.app` in Vercel

## Active Bug — Sign-up "Failed to Fetch" (NOT fully resolved)

Sign-up at `https://aetherops-govw.vercel.app/sign-up` was returning "Failed to fetch".

**Root causes found and fixed so far:**
1. `emailRedirectTo` in sign-up form was hitting Supabase URL whitelist → removed
2. User profile row not created on auto-confirmed sign-up → fixed via `ensureUserProfileAction`
3. Supabase Site URL was localhost → updated to prod URL in Supabase dashboard
4. `NEXT_PUBLIC_APP_URL` was localhost → updated in Vercel env

**Still untested** — sign-up has not been successfully completed yet. Next session: try sign-up, capture the exact error message from the form if it still fails, and trace it. The form now shows error text in a red box so the actual message will be visible.

**If it still fails, check in order:**
1. Open browser devtools → Network tab → find the failing request and check the actual error/status
2. Check Vercel runtime logs: `vercel logs --environment production --limit 50`
3. Confirm Supabase dashboard shows correct Site URL and Redirect URLs saved

## Pending / To-Do

### Critical — First Login Blocker
- [ ] **Complete sign-up flow** — "failed to fetch" reported but not fully debugged. Try `https://aetherops-govw.vercel.app/sign-up`, capture exact error. See "Active Bug" section above.
- [ ] **First user = admin** — `ensureUserProfileAction` gives first signup `admin` role automatically. No manual DB change needed.

### Infrastructure
- [ ] **Custom domain** — Vercel → Domains → add domain (e.g. `app.grantops.ai`). Also update Supabase Site URL + Redirect URLs and `NEXT_PUBLIC_APP_URL` in Vercel env to match.
- [ ] **Rename Vercel project** — currently `aetherops`; rename to `grantops` if desired (changes prod URL to `grantops-govw.vercel.app`)
- [ ] **Stripe activation** — add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Vercel env
- [ ] **Upgrade Vercel plan** — Hobby limits cron to once daily; Pro unlocks per-minute crons

### Product / Features
- [ ] **Slack integration** — add `SLACK_SIGNING_SECRET` to Vercel env
- [ ] **Webhook fulfillment** — set `PROVISION_CONNECTOR=http_webhook` + `PROVISION_WEBHOOK_URL` in Vercel env
- [ ] **OpenRouter AI fallback** — add `AI_OPENROUTER_API_KEY` to Vercel env for auto-failover if Google is down
- [ ] **Middleware deprecation** — Next.js 16 warns `middleware` is deprecated; rename `src/middleware.ts` → `src/proxy.ts` when convenient
- [ ] **EMAIL_FROM in Vercel** — confirm `EMAIL_FROM` env var is set (was in `.env.local` but not confirmed in Vercel env ls output)

### Code Quality
- [ ] E2E tests — extend Playwright specs for access reviews, vault, SSO flows
- [ ] Unit tests for AI triage edge cases

## Key Env Vars (Vercel Production)

| Var | Status | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ | Supabase direct connection |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | |
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://aetherops-govw.vercel.app` |
| `AI_GOOGLE_API_KEY` | ✓ | Active AI provider (Gemini) |
| `ALLOW_AI_PLATFORM_FALLBACK` | ✓ | `true` |
| `RESEND_API_KEY` | ✓ | |
| `DEFAULT_ORGANIZATION_ID` | ✓ | `org_demo` |
| `API_KEY_PEPPER` | ✓ | |
| `FIELD_ENCRYPTION_KEY` | ✓ | |
| `CRON_SECRET` | ✓ | |
| `EMAIL_FROM` | ? | In `.env.local` but verify it's in Vercel |
| `STRIPE_SECRET_KEY` | ✗ | Needed for billing |
| `STRIPE_WEBHOOK_SECRET` | ✗ | Needed for billing |
| `SLACK_SIGNING_SECRET` | ✗ | Needed for Slack approvals |
| `PROVISION_WEBHOOK_URL` | ✗ | Needed for real fulfillment |

## Supabase MCP Access

Supabase MCP server added via:
```
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token <token>
```
Config in `.claude.json` (local, not committed). Available from next session onward.

Note: the management token provided (`sbp_ead6...`) belongs to a different Supabase account — it shows CodeBuddy AI and Carbon tracker projects, NOT `lbqrgvqmurshifvttavg`. If you need management API access, log into the correct Supabase account and generate a new token.

## Common Commands

```bash
npm run dev              # dev server :3000
npm run build            # production build + type check
npm run lint             # ESLint
npm run db:migrate       # apply migrations
npm run db:seed          # seed demo data (org + catalog tiles already seeded in prod)
npm run db:push          # push schema to DB (dev)
vercel env ls            # list Vercel env vars
vercel logs --environment production --limit 50  # prod logs
vercel deploy --prod --yes  # manual prod deploy
```
