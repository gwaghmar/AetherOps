# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```text
aetherops/
├── src/                     # Application source
│   ├── app/                 # Next.js App Router pages, actions, API routes
│   ├── components/          # Shared UI components
│   ├── server/              # Domain/service layer and integration orchestration
│   ├── db/                  # Drizzle schema and DB client
│   ├── lib/                 # Cross-layer helpers (auth/env/validation/security)
│   └── data/                # Static seed/template data
├── drizzle/                 # SQL migrations + drizzle metadata snapshots
├── e2e/                     # Playwright end-to-end tests
├── tests/                   # Vitest unit/integration tests
├── scripts/                 # Operational and setup scripts
├── docs/                    # Product/integration/operator docs
├── supabase/                # Supabase local project support files
├── .github/workflows/       # CI automation
├── package.json             # Scripts and dependency manifest
├── next.config.ts           # Next.js runtime/security headers config
├── drizzle.config.ts        # Drizzle migration config
└── playwright.config.ts     # E2E test runner config
```

## Directory Purposes

**`src/app`:**
- Purpose: App Router entrypoint for UI and HTTP surfaces.
- Contains: Route segments such as `src/app/(dashboard)/**`, auth pages (`src/app/sign-in/page.tsx`), actions (`src/app/actions/*.ts`), and API handlers (`src/app/api/**/route.ts`).
- Key files: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/page.tsx`, `src/app/global-error.tsx`.

**`src/server`:**
- Purpose: Business/domain layer that orchestrates workflows and side effects.
- Contains: Request lifecycle (`src/server/create-request.ts`), decisioning (`src/server/request-decision.ts`), fulfillment queue (`src/server/fulfillment-queue.ts`), connectors (`src/server/connectors/**`), AI services (`src/server/ai/**`), and notifications/webhooks.
- Key files: `src/server/create-request.ts`, `src/server/request-decision.ts`, `src/server/fulfillment.ts`, `src/server/webhooks.ts`, `src/server/policy-engine.ts`.

**`src/db`:**
- Purpose: Database schema and connection boundary.
- Contains: App tables in `src/db/app-schema.ts`, auth tables in `src/db/auth-schema.ts`, schema barrel in `src/db/schema.ts`, and connection in `src/db/index.ts`.
- Key files: `src/db/index.ts`, `src/db/app-schema.ts`, `src/db/auth-schema.ts`.

**`src/lib`:**
- Purpose: Shared framework-agnostic helpers used across app/api/server layers.
- Contains: Auth/session wrappers, env validation, payload schemas, security helpers, Stripe helper, API SDK helper.
- Key files: `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/env.ts`, `src/lib/request-schemas.ts`, `src/lib/approval-email-token.ts`.

**`src/components`:**
- Purpose: Reusable presentational and interactive UI components consumed by route pages/layouts.
- Contains: Navigation, request hub widgets, admin and copilot support components.
- Key files: `src/components/dashboard-nav.tsx`, `src/components/requests-hub.tsx`, `src/components/toast.tsx`.

**`tests` and `e2e`:**
- Purpose: Automated verification.
- Contains: Vitest tests in `tests/*.test.ts` and Playwright specs in `e2e/*.spec.ts`.
- Key files: `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML/body shell and global styles.
- `src/app/(dashboard)/layout.tsx`: Authenticated app shell and navigation.
- `src/app/actions/*.ts`: Server action mutation entrypoints.
- `src/app/api/**/route.ts`: HTTP API entrypoints for web/app integrations.

**Configuration:**
- `package.json`: Runtime/build/test scripts and dependencies.
- `next.config.ts`: Security headers, turbopack root, node externals.
- `tsconfig.json`: TypeScript strict mode and `@/*` path alias.
- `drizzle.config.ts`: Migration generation/push settings.
- `vercel.json`: Deployment/runtime policy in Vercel.

**Core Logic:**
- `src/server/create-request.ts`: Canonical request creation orchestration.
- `src/server/request-decision.ts`: Approval/deny/needs-info transitions.
- `src/server/fulfillment-queue.ts`: Durable job queue processing.
- `src/server/webhooks.ts`: Outbound webhook delivery and retries.
- `src/server/ai/*.ts`: AI model selection, prompts, guards, triage.

**Testing:**
- `tests/*.test.ts`: Unit/integration checks for lib/server behavior.
- `e2e/*.spec.ts`: Full workflow/browser-level checks.
- `.github/workflows/ci.yml`: CI sequence (lint, build, unit, db setup, e2e).

## Naming Conventions

**Files:**
- Route handlers use `route.ts` under segment folders, for example `src/app/api/v1/requests/route.ts`.
- App Router pages use `page.tsx` and shared shells use `layout.tsx`, for example `src/app/(dashboard)/requests/page.tsx`.
- Service/helper modules use kebab-case names, for example `src/server/agent-rate-limit.ts`, `src/lib/approval-email-token.ts`.

**Directories:**
- Route grouping uses parentheses in App Router, for example `src/app/(dashboard)`.
- Integration and capability folders are domain-oriented (`src/server/ai`, `src/server/connectors`, `src/server/notifications`).

## Where to Add New Code

**New Feature:**
- Primary code: Add page/UI under `src/app/(dashboard)/<feature>/` and shared service logic in `src/server/<feature>.ts`.
- Tests: Add unit tests in `tests/<feature>.test.ts`; add flow coverage in `e2e/<feature>-flow.spec.ts` when user journeys change.

**New API Endpoint:**
- Implementation: Add `src/app/api/<scope>/<name>/route.ts`.
- Reusable business logic: Place workflow code in `src/server/<domain>.ts` instead of embedding business rules in route handlers.

**New Server Action:**
- Implementation: Add to existing module in `src/app/actions/` by domain (`requests.ts`, `admin.ts`, etc.), or create a new domain action file when scope is isolated.
- Validation/auth helpers: Reuse `src/lib/session.ts` and `src/lib/request-schemas.ts` patterns.

**New Database Model:**
- Schema: Add table definition to `src/db/app-schema.ts` (or `src/db/auth-schema.ts` for auth domain).
- Export path: Ensure `src/db/schema.ts` re-exports the new table.
- Migration: Add/update SQL in `drizzle/` via Drizzle tooling.

**Utilities:**
- Shared helpers: Add cross-layer helpers to `src/lib/`.
- Domain-specific helpers: Keep inside `src/server/<domain>/` or alongside owning module in `src/server/`.

## Special Directories

**`drizzle/`:**
- Purpose: SQL migration files and Drizzle metadata snapshots.
- Generated: Yes.
- Committed: Yes.

**`.next/`:**
- Purpose: Next.js build/dev output artifacts.
- Generated: Yes.
- Committed: No.

**`supabase/`:**
- Purpose: Local Supabase tooling/config linkage.
- Generated: Mixed (tooling files + project config).
- Committed: Yes.

**`test-results/`:**
- Purpose: Generated artifacts from test runs.
- Generated: Yes.
- Committed: No (by convention with ignore rules).

---

*Structure analysis: 2026-04-13*
