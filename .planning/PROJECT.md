# AetherOps

## What This Is

AetherOps is a ServiceNow-style operations platform adapted for AI agents and AI-native companies. It manages service requests end-to-end: intake, policy checks, approvals, fulfillment, and audits across dashboard, API, and integration channels. The current system is already functional as a brownfield foundation and is being extended toward agent-native enterprise workflows.

## Core Value

AI agents and humans can submit and complete governed operational requests with reliable approval, fulfillment, and audit trails in one platform.

## Requirements

### Validated

- ✓ Multi-tenant request intake via UI and API with shared lifecycle logic - existing
- ✓ Approval workflow with decision transitions and audit events - existing
- ✓ Fulfillment queue with connector-based execution and retry flows - existing
- ✓ Authenticated dashboard experience with role-aware access patterns - existing
- ✓ Agent/API security primitives (keys, limits, validation) for programmatic access - existing
- ✓ Integration surfaces for Stripe, Slack, webhook connectors, and email delivery - existing

### Active

- [ ] Harden multi-tenant isolation and authorization paths for all agent and Slack workflows
- [ ] Expand AI-agent-native request and fulfillment experiences for AI companies
- [ ] Improve reliability guardrails for distributed rate limiting and policy enforcement
- [ ] Strengthen testing depth across route handlers, server actions, and critical UI flows
- [ ] Establish production-grade observability and operational diagnostics for core workflows

### Out of Scope

- Building a full ITSM clone parity with all ServiceNow modules in v1 - keeps scope focused on AI-company operations
- Rewriting existing architecture from scratch - current codebase already provides a strong execution baseline
- Native mobile apps in initial scope - prioritize web and API workflows first

## Context

- Brownfield Next.js + TypeScript platform with modular monolith architecture and clear domain-service boundaries.
- Existing request lifecycle is implemented across `src/app/actions/requests.ts`, `src/app/api/v1/requests/route.ts`, `src/server/create-request.ts`, `src/server/request-decision.ts`, and `src/server/fulfillment-queue.ts`.
- Integrations already present for Stripe billing, Slack entrypoints, webhook-based provisioning, policy webhooks, and Resend email.
- Codebase map identified high-priority concerns in rate-limiting behavior, Slack tenant mapping, and permissive approval fallback that should be addressed early.

## Constraints

- **Tech stack**: Next.js 16 + React 19 + Drizzle/Postgres + Better Auth - leverage current architecture to ship quickly
- **Security**: Multi-tenant correctness and fail-closed behavior are non-negotiable - prevents cross-tenant leakage and unauthorized actions
- **Reliability**: Queue processing, policy checks, and rate limits must behave consistently across distributed deployments - platform trust depends on this
- **Execution**: Brownfield-first evolution, not rewrite - preserve delivery velocity and reduce migration risk

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Position product as "ServiceNow for AI agents and AI companies" | Aligns with user vision and existing architecture strengths | - Pending |
| Treat current implementation as validated baseline, then harden and extend | Reduces rework and captures value from already-shipped workflows | - Pending |
| Prioritize multi-tenant safety and workflow reliability before broad feature expansion | Core trust and correctness are prerequisites for growth | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after initialization*
