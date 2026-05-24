# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**AI inference:**
- OpenAI-compatible model endpoint (provider-configurable) - Organization and platform AI generation in `src/server/ai/client.ts`
  - SDK/Client: `@ai-sdk/openai` + `ai`
  - Auth: `APP_AI_PLATFORM_API_KEY` (fallback), org-scoped encrypted BYOK from `organization_ai_settings`

**Payments & billing:**
- Stripe - Checkout sessions, customer portal, and subscription webhooks in `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`, and `src/app/api/stripe/webhook/route.ts`
  - SDK/Client: `stripe`
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plus price IDs (`STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`)

**Email delivery:**
- Resend Email API - Transactional email sends in `src/server/email/send-email.ts`
  - SDK/Client: direct `fetch` to `https://api.resend.com/emails`
  - Auth: `RESEND_API_KEY` (with `EMAIL_FROM`)

**Messaging/chat ingress:**
- Slack request verification and slash-command handling in `src/app/api/slack/slash/route.ts` and `src/app/api/integrations/slack/interactions/route.ts`
  - SDK/Client: native HMAC verification (`node:crypto`) and internal helpers in `src/lib/slack-signature.ts`
  - Auth: `SLACK_SIGNING_SECRET`

**Policy/provision webhooks:**
- External policy decision service in `src/server/policy-engine.ts`
  - SDK/Client: direct `fetch`
  - Auth: endpoint-based (`POLICY_ENGINE_URL`, optional timeout config)
- External fulfillment webhook connector in `src/server/connectors/http-webhook.ts`
  - SDK/Client: direct `fetch`
  - Auth: `PROVISION_WEBHOOK_BEARER` (optional), endpoint `PROVISION_WEBHOOK_URL`

## Data Storage

**Databases:**
- PostgreSQL (self-hosted or Supabase-managed)
  - Connection: `DATABASE_URL`
  - Client: `pg` pool + `drizzle-orm` in `src/db/index.ts`; migrations/config in `drizzle.config.ts`

**File Storage:**
- Local filesystem only for generated artifacts in process memory/response flow (for example PDF generation in `src/server/audit-pdf.ts`); no persistent blob-store client detected

**Caching:**
- Optional Redis fixed-window rate-limit backend in `src/server/agent-rate-limit.ts`
- Service/env: `REDIS_URL`
- Client: dynamic import of `ioredis`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (`@supabase/ssr`)
  - Implementation: browser/server clients in `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`; session refresh in `src/middleware.ts`; OAuth/email-link callback in `src/app/api/auth/callback/route.ts`; session helpers in `src/lib/session.ts`
  - Core auth env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - OAuth providers configured in the Supabase dashboard (Google, GitHub, Microsoft, etc.) rather than via env vars

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Bugsnag/etc package or client wiring)

**Logs:**
- Console-based operational logging in server modules (`src/server/webhooks.ts`, `src/server/email/send-email.ts`, `src/instrumentation.ts`)

## CI/CD & Deployment

**Hosting:**
- Vercel Next.js target configured in `vercel.json`

**CI Pipeline:**
- GitHub Actions workflow at `.github/workflows/ci.yml` (Node setup, lint, build, unit tests, Drizzle push, seed, Playwright E2E)

## Environment Configuration

**Required env vars:**
- Platform/core: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, one of `DEFAULT_ORGANIZATION_ID` or `DEFAULT_ORGANIZATION_SLUG` (`README.md`, `src/lib/env.ts`)
- AI: `APP_AI_PLATFORM_API_KEY` (fallback mode), optional `APP_AI_PLATFORM_BASE_URL`, `APP_AI_PLATFORM_MODEL` (`src/server/ai/client.ts`)
- Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Stripe price IDs (`src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts`)
- Email: `RESEND_API_KEY`, optional `EMAIL_FROM` (`src/server/email/send-email.ts`)
- Worker/security/integration: `CRON_SECRET`, `SLACK_SIGNING_SECRET`, `CHAT_INGEST_SECRET`, `CHAT_INGEST_ORG_ID`, `PROVISION_CONNECTOR`, `PROVISION_WEBHOOK_URL`, optional `PROVISION_WEBHOOK_BEARER`, `POLICY_ENGINE_URL`, `FIELD_ENCRYPTION_KEY`, optional `REDIS_URL` (`src/app/api/internal/worker/fulfillment/route.ts`, `src/lib/env.ts`, `src/server/agent-rate-limit.ts`)

**Secrets location:**
- Local development: `.env.local` / `.env` (referenced in `drizzle.config.ts` and `playwright.config.ts`)
- Cloud/runtime: deployment environment variables (Vercel for app, provider dashboards for external services)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/stripe/webhook` - Stripe subscription lifecycle updates (`src/app/api/stripe/webhook/route.ts`)
- `POST /api/slack/slash` - Slack slash command endpoint (`src/app/api/slack/slash/route.ts`)
- `POST /api/integrations/slack/interactions` - Slack interactivity endpoint (`src/app/api/integrations/slack/interactions/route.ts`)
- `POST /api/internal/worker/fulfillment` - scheduled internal worker trigger with bearer secret (`src/app/api/internal/worker/fulfillment/route.ts`)

**Outgoing:**
- Resend API `POST https://api.resend.com/emails` (`src/server/email/send-email.ts`)
- Organization-configured governance webhooks (`targetUrl` from DB) with HMAC signatures (`src/server/webhooks.ts`)
- Provision connector outbound POST to `PROVISION_WEBHOOK_URL` (`src/server/connectors/http-webhook.ts`)
- Policy engine POST to `POLICY_ENGINE_URL` (`src/server/policy-engine.ts`)

---

*Integration audit: 2026-04-13*
