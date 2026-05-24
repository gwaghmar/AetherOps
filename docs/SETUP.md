# Setup checklist (operators)

Use this when onboarding a new environment (startup, staging, production).

## References

- [Vercel AI SDK — structured output](https://ai-sdk.dev/cookbook/next/generate-object) — how catalog generation validates JSON with Zod.
- [OpenRouter API](https://openrouter.ai/docs) — OpenAI-compatible `baseURL` for BYOK.
- [Microsoft Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail) — future org-level Outlook sending (OAuth).
- [Gmail API — sending](https://developers.google.com/gmail/api/guides/sending) — future Google workspace sending (OAuth).

## 1. Database and schema

1. **Supabase (cloud, no Docker):** Create a project, copy **Database → Connection string (URI, Direct, `sslmode=require`)** into `DATABASE_URL` in `.env` / `.env.local`. Details: `supabase/README.md`.
2. Apply schema:
   - **Production / clean DB:** `npm run db:migrate` (SQL under `drizzle/`).
   - **Fast dev:** `npm run db:supabase:sync` (`db:push` + `db:seed`), or `npm run db:push` alone then `npm run db:seed`.
3. Avoid mixing `db:push` and `db:migrate` on the same database without a baseline; prefer migrate for long-lived environments.

## 2. Auth and URLs

1. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Project Settings → API.
2. `NEXT_PUBLIC_APP_URL` — public origin (must match Supabase Site URL + Redirect URLs in production).
3. `DEFAULT_ORGANIZATION_ID` or `DEFAULT_ORGANIZATION_SLUG` — must exist in `organization` before sign-ups.

## 3. AI

1. **BYOK (recommended):** As an admin, open **Admin → AI**, set model id, optional base URL (e.g. OpenRouter `https://openrouter.ai/api/v1`), and API key. With `FIELD_ENCRYPTION_KEY` set, keys are encrypted at rest like webhook secrets.
2. **Platform fallback:** Set `APP_AI_PLATFORM_API_KEY` (and optional `APP_AI_PLATFORM_BASE_URL`, `APP_AI_PLATFORM_MODEL`). In **production**, also set `ALLOW_AI_PLATFORM_FALLBACK=true` or the server will not use the platform key without org BYOK.
3. **Tests:** `TEST_AI_MOCK=1` makes onboarding catalog **generation** return a fixture (still requires schema/migrations).

## 4. First-run wizard

1. Sign in as the first admin (first user in DB is promoted automatically).
2. Open **Onboarding** from the home banner or `/onboarding`.
3. Complete catalog (AI or template), then use **Admin → Routing**, **Integrations**, and invites as prompted.

## 5. Email

1. `RESEND_API_KEY` and `EMAIL_FROM` for approval notifications and optional invite emails.
2. Org-level providers (`organization_email_settings`): `graph` / `gmail` are reserved for OAuth integrations; today the app logs a warning and falls back to Resend/env.

## 6. Invites

1. Admins create invites from the onboarding wizard or by calling `adminCreateInvite` (server action) from future UI.
2. Share `/sign-up?invite=…` links; after sign-up, `finalizeInviteFromToken` moves the user to the invited org and role.

## 7. Health page

**Admin → Setup status** summarizes AI, catalog, routing, email, webhook, and pending invite counts.

## Optional CLI

Run `npx tsx scripts/setup-wizard.ts` for a short terminal reminder of env vars (no secrets collected).
