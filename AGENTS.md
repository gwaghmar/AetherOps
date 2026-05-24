<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product / UX prompts

For behavioral, catalog, or workflow work, read and follow [.cursor/skills/think-first-and-validate/SKILL.md](.cursor/skills/think-first-and-validate/SKILL.md): reason from real-world practice, validate with search when needed, then implement.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**AetherOps**

AetherOps is a ServiceNow-style operations platform adapted for AI agents and AI-native companies. It manages service requests end-to-end: intake, policy checks, approvals, fulfillment, and audits across dashboard, API, and integration channels. The current system is already functional as a brownfield foundation and is being extended toward agent-native enterprise workflows.

**Core Value:** AI agents and humans can submit and complete governed operational requests with reliable approval, fulfillment, and audit trails in one platform.

### Constraints

- **Tech stack**: Next.js 16 + React 19 + Drizzle/Postgres + Supabase Auth - leverage current architecture to ship quickly
- **Security**: Multi-tenant correctness and fail-closed behavior are non-negotiable - prevents cross-tenant leakage and unauthorized actions
- **Reliability**: Queue processing, policy checks, and rate limits must behave consistently across distributed deployments - platform trust depends on this
- **Execution**: Brownfield-first evolution, not rewrite - preserve delivery velocity and reduce migration risk
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript (strict) - Application and API code in `src/`, configuration in `*.ts`
- SQL - Generated/managed migrations in `drizzle/` and Postgres DDL via Drizzle
- PowerShell/JS scripts - Project automation in `scripts/`
## Runtime
- Node.js 20+ required in `README.md`
- Node.js 22 used in CI at `.github/workflows/ci.yml`
- npm (commands in `package.json` and install command in `vercel.json`)
- Lockfile: present (`package-lock.json`)
## Frameworks
- Next.js 16.2.2 - Full-stack app router web framework (`package.json`, `src/app/`)
- React 19.2.4 - UI rendering (`package.json`)
- Better Auth 1.5.6 - Authentication/session layer (`src/lib/auth.ts`)
- Drizzle ORM 0.45.2 - Database access (`src/db/index.ts`)
- Vitest 4.1.3 - Unit tests (`vitest.config.ts`, `tests/**/*.test.ts`)
- Playwright 1.59.1 - End-to-end tests (`playwright.config.ts`, `e2e/`)
- Turbopack (Next.js) - Dev/build acceleration in `next.config.ts`
- ESLint 9 + `eslint-config-next` - Linting in `eslint.config.mjs`
- Tailwind CSS 4 + PostCSS plugin - Styling pipeline in `postcss.config.mjs`
- Drizzle Kit 0.31.10 - Migration/push tooling in `drizzle.config.ts`
- TSX 4.21.0 - Script runner in `package.json` scripts
## Key Dependencies
- `next` 16.2.2 - Application runtime and routing (`package.json`)
- `better-auth` 1.5.6 - Auth flows and provider integrations (`src/lib/auth.ts`)
- `drizzle-orm` 0.45.2 + `pg` 8.20.0 - Postgres persistence (`src/db/index.ts`)
- `zod` 4.3.6 - Runtime validation at API/action boundaries (for example `src/lib/env.ts`, `src/app/api/v1/requests/route.ts`)
- `stripe` 22.0.1 - Billing checkout/webhooks (`src/lib/stripe.ts`, `src/app/api/stripe/*`)
- `@ai-sdk/openai` + `ai` - LLM provider abstraction and inference (`src/server/ai/client.ts`, `src/app/api/ai/*`)
- `pdf-lib` 1.17.1 - Audit PDF generation (`src/server/audit-pdf.ts`)
- `dotenv` 17.4.0 - Local env loading for CLI/test tooling (`drizzle.config.ts`, `playwright.config.ts`)
## Configuration
- Runtime configuration is environment-variable driven via `process.env` across `src/lib/env.ts`, `src/lib/auth.ts`, `src/server/ai/client.ts`, and route handlers under `src/app/api/`
- Production guardrails enforce required env and safe settings (`src/lib/env.ts`, `README.md`)
- Next.js config and security headers in `next.config.ts`
- TypeScript compiler and alias config in `tsconfig.json`
- Deployment build/install commands in `vercel.json`
- DB CLI configuration in `drizzle.config.ts`
- Lint and style configs in `eslint.config.mjs` and `postcss.config.mjs`
## Platform Requirements
- Node.js 20+ and npm (`README.md`)
- PostgreSQL required via `DATABASE_URL` (`src/db/index.ts`, `README.md`)
- Optional Supabase CLI/local stack config in `supabase/config.toml`
- Deploy target is Vercel Next.js runtime (`vercel.json`)
- Requires managed Postgres and environment configuration for auth, connectors, and integrations (`README.md`, `src/lib/env.ts`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Route handlers use `route.ts` under App Router API directories (example: `src/app/api/v1/requests/route.ts`).
- Server utilities use kebab-case `.ts` files (examples: `src/server/request-decision.ts`, `src/server/agent-rate-limit.ts`).
- React component files use kebab-case `.tsx` even for exported PascalCase components (example: `src/app/(dashboard)/requests/new/new-request-form.tsx` exports `NewRequestForm`).
- Test files use `*.test.ts` in `tests/` for unit tests and `*.spec.ts` in `e2e/` for Playwright flows (examples: `tests/request-schemas.test.ts`, `e2e/governance-flow.spec.ts`).
- Exported functions use camelCase and describe intent clearly (`createRequestAction` in `src/app/actions/requests.ts`, `sendTransactionalEmail` in `src/server/email/send-email.ts`).
- Internal helpers stay local and camelCase (`parseLimit`, `tooMany` in `src/app/api/v1/requests/route.ts`).
- Boolean-style helpers use `is*` / `has*` naming (`isProduction` in `src/lib/env.ts`).
- Local variables use concise camelCase (`orgId`, `requesterId`, `fieldSchema` in `src/app/actions/requests.ts`).
- Constant configuration values are uppercase snake case (`WINDOW_MS` in `src/app/api/v1/requests/route.ts`).
- Type aliases and exported types use PascalCase (`FieldType`, `FieldSchemaJson`, `RequestTypeOption` in `src/lib/request-schemas.ts` and `src/app/(dashboard)/requests/new/new-request-form.tsx`).
## Code Style
- Tool used: ESLint with Next.js core + TypeScript presets from `eslint.config.mjs`.
- Key observed style: semicolons enabled, double quotes, trailing commas on multiline objects/arrays/functions (seen across `src/lib/env.ts`, `src/app/actions/requests.ts`, `e2e/governance-flow.spec.ts`).
- No dedicated Prettier config detected; rely on ESLint + editor formatting.
- Tool used: `eslint` script in `package.json` with flat config in `eslint.config.mjs`.
- Config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- Ignore paths include `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` in `eslint.config.mjs`.
## Import Organization
- Use `@/*` alias mapped in `tsconfig.json` (`"@/*": ["./src/*"]`).
- Prefer alias imports over deep relative paths for app code (examples in `src/app/api/v1/requests/route.ts` and tests like `tests/request-schemas.test.ts`).
## Error Handling
- API routes validate input with Zod and return structured JSON errors (`{ error, code, details? }`) via `Response.json` in `src/app/api/v1/requests/route.ts`.
- Server actions throw `Error` for invalid auth/ownership/state and return typed `{ ok: false }` for recoverable validation outcomes (`src/app/actions/requests.ts`).
- Domain errors are handled explicitly with `instanceof` checks before fallback throw (`PolicyDeniedError` handling in `src/app/api/v1/requests/route.ts` and `src/app/actions/requests.ts`).
## Logging
- Configuration/runtime warnings use prefixed log messages (`[env]` in `src/lib/env.ts`, `[email]` in `src/server/email/send-email.ts`).
- External service failures log status + body snippet and return controlled result objects (`src/server/email/send-email.ts`).
- Use logs for degraded-mode behavior (missing optional integrations) instead of throwing (`src/server/email/send-email.ts`).
## Comments
- Add short comments for security, production guardrails, and environment assumptions (examples in `src/lib/env.ts`, `playwright.config.ts`).
- Avoid narrative comments for straightforward mapping/query code; most business logic remains uncommented (`src/app/actions/requests.ts`).
- JSDoc-style block comments appear on exported functions that encode environment/runtime contracts (`assertProductionEnv`, `getTrustedAuthOrigins` in `src/lib/env.ts`).
- Inline comments are used sparingly for nuanced coercion or fallback reasoning (`src/lib/request-schemas.ts`).
## Function Design
- Inputs are frequently object-shaped for readability and future extensibility (`sendTransactionalEmail(input)`, `createRequestAction(input)`).
- Boundary schemas validate function/action inputs immediately (`createRequestInputSchema`, `decideApprovalInputSchema` in `src/app/actions/requests.ts`).
- APIs return `Response` with status codes and typed JSON payloads (`src/app/api/v1/requests/route.ts`).
- Server actions return discriminated object results for UI handling (`{ ok: true, requestId }` vs `{ ok: false, error }` in `src/app/actions/requests.ts`).
## Module Design
- Prefer named exports over default exports in app/server/lib modules (`src/lib/request-schemas.ts`, `src/app/actions/requests.ts`).
- Config files may use default export where framework expects it (`vitest.config.ts`, `playwright.config.ts`).
- Barrel-file usage is minimal; direct imports from concrete module paths are standard (`@/server/create-request`, `@/lib/session` in `src/app/actions/requests.ts`).
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Use `src/app` for route-driven UI, server actions, and HTTP endpoints.
- Use `src/server` as domain/service layer that encapsulates business workflows and integrations.
- Use `src/db` + Drizzle ORM as a shared persistence boundary consumed by both route handlers and server services.
## Layers
- Purpose: Render authenticated dashboard/auth pages and bind user interactions.
- Location: `src/app/(dashboard)/**`, `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/page.tsx`.
- Contains: Server Components, route segment layouts, and client subcomponents.
- Depends on: `src/lib/session.ts`, `src/db/index.ts`, `src/server/org-catalog.ts`, `src/components/**`.
- Used by: Browser navigation and direct URL route requests.
- Purpose: Handle authenticated user mutations from UI with cache revalidation.
- Location: `src/app/actions/requests.ts`, `src/app/actions/admin.ts`, `src/app/actions/change-tickets.ts`, `src/app/actions/ai-org.ts`.
- Contains: `"use server"` action functions, boundary validation, role checks, `revalidatePath` invalidation.
- Depends on: `src/lib/session.ts`, `src/lib/request-schemas.ts`, `src/server/**`, `src/db/index.ts`.
- Used by: Client forms/components under `src/app/(dashboard)/**`.
- Purpose: Expose machine/client endpoints (auth, v1 API, webhooks, cron worker, admin export).
- Location: `src/app/api/**/route.ts`.
- Contains: Request parsing, auth/secret verification, input validation, HTTP response mapping.
- Depends on: `src/server/**`, `src/lib/**`, `src/db/index.ts`.
- Used by: External clients, platform webhooks, cron schedulers, and frontend calls.
- Purpose: Centralize cross-route workflows for request lifecycle, approvals, fulfillment, and auditing.
- Location: `src/server/create-request.ts`, `src/server/request-decision.ts`, `src/server/fulfillment-queue.ts`, `src/server/fulfillment.ts`, `src/server/webhooks.ts`, `src/server/policy-engine.ts`.
- Contains: Multi-step orchestration, transactional updates, side-effect dispatch (audit/webhooks/notifications).
- Depends on: `src/db/index.ts`, `src/db/schema.ts`, connector modules in `src/server/connectors/**`, helpers in `src/lib/**`.
- Used by: `src/app/actions/**` and `src/app/api/**/route.ts`.
- Purpose: Resolve org AI credentials, enforce guards, and run AI-assisted workflows.
- Location: `src/server/ai/client.ts`, `src/server/ai/request-guard.ts`, `src/server/ai/triage.ts`, `src/server/ai/prompts.ts`.
- Contains: Model selection, request guarding/rate checks, prompt definitions, triage logic.
- Depends on: `src/db/index.ts`, provider SDKs configured by `src/lib/env.ts`.
- Used by: `src/app/api/ai/chat/route.ts`, `src/app/api/ai/admin-chat/route.ts`, `src/server/create-request.ts`.
- Purpose: Define and access relational schema/entities.
- Location: `src/db/app-schema.ts`, `src/db/auth-schema.ts`, `src/db/schema.ts`, `src/db/index.ts`.
- Contains: Drizzle table models and shared `db` connection.
- Depends on: `drizzle-orm`, `pg`, environment variables via `DATABASE_URL`.
- Used by: `src/server/**`, selected Server Components in `src/app/(dashboard)/**`, some route handlers in `src/app/api/**`.
## Data Flow
- Server-first data loading in route components (`src/app/(dashboard)/requests/page.tsx` uses direct DB queries).
- Session/role state resolved server-side in `src/lib/session.ts`.
- Cache invalidation on mutations is explicit via `revalidatePath` in server actions and specific API routes.
## Key Abstractions
- Purpose: One shared contract for creating request records regardless of caller.
- Examples: `src/server/create-request.ts`, `src/app/actions/requests.ts`, `src/app/api/v1/requests/route.ts`, `src/app/api/v1/ingest/chat/route.ts`.
- Pattern: Entry points validate/authenticate, then delegate to `createRequestCore`.
- Purpose: Isolate approval transitions from fulfillment execution.
- Examples: `src/server/request-decision.ts`, `src/server/fulfillment-queue.ts`, `src/server/fulfillment.ts`.
- Pattern: Transactional decision write + queued idempotent processing.
- Purpose: Switch provisioning backend by environment.
- Examples: `src/server/connectors/registry.ts`, `src/server/connectors/http-webhook.ts`.
- Pattern: Runtime strategy selection (`stub`, `log`, `http_webhook`) through a typed connector interface.
- Purpose: Centralize auth/session wiring.
- Examples: `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/api/auth/[...all]/route.ts`.
- Pattern: Better Auth adapter + helper guards (`requireSession`, `requireRole`) consumed by routes/actions/pages.
## Entry Points
- Location: `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/page.tsx`.
- Triggers: Browser HTTP requests to App Router pages.
- Responsibilities: HTML shell, authenticated dashboard framing, navigation and child route composition.
- Location: `src/app/actions/*.ts`.
- Triggers: Form/action submissions from React components.
- Responsibilities: AuthZ + validation + domain service delegation + path revalidation.
- Location: `src/app/api/auth/[...all]/route.ts`, `src/app/api/v1/requests/route.ts`, `src/app/api/v1/request-types/route.ts`, `src/app/api/v1/ingest/chat/route.ts`.
- Triggers: Programmatic HTTP requests.
- Responsibilities: Token/session checks, schema checks, service invocation, JSON responses.
- Location: `src/app/api/internal/worker/fulfillment/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/integrations/slack/interactions/route.ts`.
- Triggers: Cron systems and third-party webhook callbacks.
- Responsibilities: Secret/signature validation, operational workflow triggering, retry-safe handling.
## Error Handling
- API routes return explicit JSON error shapes and status codes (example in `src/app/api/v1/requests/route.ts`).
- Actions throw on authorization/invalid state and return typed failure objects for validation/policy failures (`src/app/actions/requests.ts`).
- Domain services throw for invalid transitions and rely on transactional guards (`src/server/request-decision.ts`).
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| think-first-and-validate | Use for product/UX/feature prompts—reason from real-world practice, validate assumptions, then implement. Trigger when the user asks for behavioral changes, catalog structure, workflows, or says to think first / use common sense / validate online. | `.cursor/skills/think-first-and-validate/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
