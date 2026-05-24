# AetherOps

Web app for the flow **request → approve → fulfill (connector) → audit + CSV export**. Fulfillment is pluggable: local **stub**, **http_webhook** for external automation, or additional connectors as you add them.

## Prerequisites

- Node.js 20+
- **PostgreSQL** — easiest path: [**Supabase** (cloud)](https://supabase.com/dashboard); set `DATABASE_URL` from **Project Settings → Database** (see `supabase/README.md`). No Docker required. You can use any other Postgres host instead.

## Setup

1. Copy `.env.example` to `.env` or `.env.local` and set:

   - `DATABASE_URL` — Postgres connection string. For Supabase cloud, use the **Direct** URI with `sslmode=require`. Production: never commit `sslmode=no-verify`.
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
   - `NEXT_PUBLIC_APP_URL` — public base URL (e.g. `http://localhost:3000` in dev)
   - `DEFAULT_ORGANIZATION_ID` — id of the org new users join (e.g. `org_demo` after seed, or your prod org UUID)
   - Optional: `DEFAULT_ORGANIZATION_SLUG` instead of id (exactly one of id or slug should resolve a row)
   - Optional: `NEXT_PUBLIC_APP_NAME` — short product name in the shell and auth screens
   - Optional: `API_KEY_PEPPER` — dedicated pepper for API key hashing
   - Optional: `FIELD_ENCRYPTION_KEY` — 32-byte base64 key; required for connector vault + BYOK
   - Optional: **Email** — `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Governance <noreply@yourdomain.com>`); optional `APPROVAL_EMAIL_SECRET` for signed approve/decline links in approver mail
   - Fulfillment: `PROVISION_CONNECTOR=stub` for dev/E2E; production use `http_webhook` with `PROVISION_WEBHOOK_URL` (and optional `PROVISION_WEBHOOK_BEARER`), or `ALLOW_STUB_PROVISION=true` only on staging

   In **production**, the app **fails fast on boot** if required env vars are missing, if `DATABASE_URL` uses `sslmode=no-verify`, if neither default-org env is set, or if `PROVISION_CONNECTOR=stub` without `ALLOW_STUB_PROVISION=true`.

2. Apply schema to the database:

   - **New empty database (recommended for prod):** `npm run db:migrate` (after `npm run db:generate` when you change schema).
   - **Quick setup against Supabase/dev:** `npm run db:supabase:sync` runs `db:push` + `db:seed`.

   If you already used `db:push` and later run `db:migrate`, you may need an empty DB or a migration baseline — see `supabase/README.md`.

3. Seed demo org + request types:

   ```bash
   npm run db:seed
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

5. Apply DB migrations for new releases:

   ```bash
   npx drizzle-kit push
   ```

   (Or use generated SQL under `drizzle/`.)

6. Open `http://localhost:3000`, sign up at `/sign-up`. New users attach to the org selected by `DEFAULT_ORGANIZATION_ID` / `DEFAULT_ORGANIZATION_SLUG` (or, in non-production only, the first org row if unset). The **first account** in the database is promoted to **admin** automatically.

7. Use **Admin → Users** to assign `approver` (and extra admins). Alternatively, in SQL:

   ```sql
   UPDATE "user" SET role = 'approver' WHERE email = 'you@company.com';
   ```

   Roles: `requester` (default for later signups), `approver`, `admin`.

### Agent HTTP API

Create an API key under **Admin → API keys**, then:

```http
POST /api/v1/requests
Authorization: Bearer gk_<lookupId>_<secret>
Content-Type: application/json

{
  "requestTypeSlug": "human_data_access",
  "requesterEmail": "colleague@example.com",
  "payload": { "resource": "...", "reason": "...", "duration_days": "7" }
}
```

`requesterEmail` must already exist as a user in the same organization. Response: `201` with `{ id, status, requestTypeSlug }`.

Rate limits (per Next.js instance, in-memory): by client IP and, when the bearer token matches `gk_<lookupId>_…`, by `lookupId`. Override with `AGENT_API_RATE_LIMIT_IP_PER_MIN` and `AGENT_API_RATE_LIMIT_KEY_PER_MIN` (defaults `120` / `60` per minute). `429` responses include `Retry-After` in seconds.

### Chat / bot ingest (shared secret)

Bridge Slack, Teams, or an internal bot without OAuth in this repo: set `CHAT_INGEST_SECRET` and `CHAT_INGEST_ORG_ID` (e.g. `org_demo`), then:

```http
POST /api/v1/ingest/chat
X-Chat-Ingest-Secret: <secret>
Content-Type: application/json

{ "requestTypeSlug": "human_data_access", "requesterEmail": "user@example.com", "payload": { ... } }
```

### Policy engine (HTTP stub)

Point `POLICY_ENGINE_URL` at a service that accepts `POST` with `{ organizationId, requestTypeSlug, payload }` and returns JSON `{ "decision": "allow" | "deny", "reason"?: string }`. Network failures **fail open** (allow) so dev keeps working; wire OPA/OpenFGA-style evaluation behind that URL in production.

### Provisioning connectors

`PROVISION_CONNECTOR` defaults to `stub` (simulated fulfillment). Set to `log` to log context then run the stub. Replace the registry in `src/server/connectors/registry.ts` with real SaaS/IdP/API calls when ready.

### Durable fulfillment queue + worker

Approvals enqueue a `fulfillment_job` row and process it immediately in the same request; pending rows (e.g. after a crash before processing) can be drained by a scheduler calling:

```http
POST /api/internal/worker/fulfillment
Authorization: Bearer <CRON_SECRET>
```

Set `CRON_SECRET` in production. See `drizzle/0002_jobs_webhooks.sql` for schema.

### Outbound webhooks + secret storage

Configure **Admin → Integrations** (or set `webhook_url` / `webhook_signing_secret` on `organization`). Events: **`request.submitted`** (new request, rich payload for Zapier/Make/Power Automate), `request.approved`, `provision.started`, `provision.succeeded`, `provision.failed`. Optional **AES-256-GCM** at rest for the signing secret when `FIELD_ENCRYPTION_KEY` is set (32 raw bytes, base64). Production should wrap that key with **KMS** — see `src/lib/kms-envelope.ts`. **Admin → Routing** configures per–request-type approver pools; see [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for GCP and Microsoft patterns.

### Audit PDF evidence pack

**Admin → Audit export** includes **Download PDF evidence** (`GET /api/admin/audit-pdf?from=…&to=…`), same date range rules as CSV.

## CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml): Postgres service, `npm run lint`, `npm run build`, Playwright E2E.

## End-to-end tests (Playwright)

With Postgres available and `.env` populated (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`):

```bash
docker compose up -d   # optional: local Postgres on port 5432
npm run test:e2e
```

The suite runs `drizzle-kit push --force` and `db:seed` once via global setup, starts `npm run dev`, then exercises sign-up → request → approval → `fulfilled`. If `DATABASE_URL` is unset, the governance test is **skipped**.

## Scripts

| Script        | Purpose                    |
| ------------- | -------------------------- |
| `npm run dev` | Next.js dev server         |
| `npm run build` | Production build         |
| `npm run start` | Production server (after `build`) |
| `npm run db:push` | Drizzle push to DB     |
| `npm run db:seed` | Seed org + catalog     |
| `npm run test:e2e` | Playwright E2E (needs DB + `.env`) |
| `npm run test:e2e:ui` | Playwright UI mode    |

## Production notes

- Set `NEXT_PUBLIC_APP_URL` to your **public HTTPS origin** so session cookies use `secure` when the URL is `https://…`. Auth is handled by Supabase Auth (`@supabase/ssr`) — see `src/lib/supabase/server.ts` and `src/middleware.ts`.
- `src/instrumentation.ts` logs missing env in production; fix deploy config if you see those warnings.
- Security headers are applied in `next.config.ts`.

## Documentation

- [docs/SETUP.md](./docs/SETUP.md) — operator checklist (DB, auth, AI BYOK, email, invites)
- [docs/](./docs/) — numbered product/architecture docs (vision, personas, flows, policy model, connector arch, AI cost model, approvals, security, fallbacks, roadmap)
