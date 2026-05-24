# Technology Stack Direction (2026)

**Project:** AetherOps  
**Scope:** Brownfield stack refinements for agent-native automation, multitenant safety, and enterprise operations  
**Researched:** 2026-04-14

## Prescriptive Recommendation

Keep the current application core (`Next.js + TypeScript + Postgres + Drizzle + Better Auth`) and add a dedicated **control-plane layer** for durable orchestration, policy decisions, and observability.  
Do **not** rewrite into microservices yet; evolve into a modular platform with explicit runtime boundaries.

## Target 2026 Platform Stack

### 1) Experience + API Layer

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| Next.js 16 + React 19 | Existing | Operator dashboard + API endpoints | Keep as primary app shell for admin, approvals, and tenant ops |
| TypeScript strict mode | Existing | End-to-end type safety | Keep; require typed contracts for every external connector and agent tool |
| Zod at boundaries | Existing | Input/output validation | Enforce at all ingress points (UI actions, API, webhooks, Slack, agent tools) |

### 2) System of Record + Tenant Isolation

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| Postgres 18 | Upgrade path | Transactional source of truth | Standardize on Postgres 18 managed service |
| Postgres RLS | Partial | Hard tenant isolation | Make RLS mandatory for tenant-bearing tables; default-deny policies |
| Drizzle ORM + migrations | Existing | Typed DB access | Keep; add tenant-context helpers so all queries are tenant-scoped by construction |
| Redis | Existing optional | Rate limits, short-lived state | Keep for distributed throttling and idempotency keys |

### 3) Durable Orchestration + Agent Runtime

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| Temporal Cloud (preferred) | New | Durable workflows, retries, compensation, long-running jobs | Adopt for fulfillment, approvals, escalations, and HITL waits |
| Internal tool-execution workers (Node/TS) | New | Connector execution + side effects | Move non-trivial side effects out of request lifecycle into durable workers |
| Event bus (lightweight first) | Incremental | Domain events across modules | Start with transactional outbox in Postgres; add Kafka only if throughput requires |

### 4) Policy + Authorization Plane

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| OPA (Rego) | New | Cross-service policy decisions and guardrails | Use for platform-wide policy-as-code (workflow, connector, deployment controls) |
| Cedar/Verified Permissions (optional path) | Conditional | Fine-grained app authorization service | Use only if AWS-centric and managed PDP is preferred over self-hosted OPA |
| Better Auth + RBAC/ABAC | Existing | Identity + tenant memberships | Keep, but externalize high-risk authorization checks to policy engine |

### 5) Agent Interoperability + Integrations

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| MCP server/client support | New | Standardized tool/resource protocol for agents | Treat MCP as first-class integration surface beside REST/webhooks |
| OpenAI-compatible multi-model gateway | Existing partial | Model/provider portability | Keep abstraction; add explicit model routing policies per tenant and workload |
| Connector SDK (internal) | New | Consistent connector contracts | Define typed contract: auth, quotas, retries, audit fields, idempotency |

### 6) Observability + Enterprise Operations

| Technology | Status | Purpose | Recommendation |
|---|---|---|---|
| OpenTelemetry traces/metrics/logs | New foundational | End-to-end visibility across app/workers/policy/agents | Instrument all request + workflow + tool calls with trace correlation |
| OTel GenAI semantic conventions | New evolving standard | LLM/agent telemetry | Adopt now with version pinning; treat as evolving (currently development status) |
| Error + incident tooling (Sentry or equivalent) | Missing | Production debugging | Add immediately for server/app + worker pipelines |
| Audit event store (Postgres append-only) | Existing partial | Compliance evidence and replay | Make immutable audit log canonical for approvals and connector actions |

## Brownfield Adoption Order (Next 2-3 Phases)

1. **Tenant Safety First**  
   Enforce Postgres RLS + remove permissive app-level fallback auth paths.
2. **Durability Second**  
   Introduce Temporal for fulfillment and long-running approvals; keep UI/API in Next.js.
3. **Policy Externalization Third**  
   Move critical authorization and workflow guardrails into OPA policies.
4. **Observability Fourth**  
   Full OpenTelemetry rollout including workflow + agent spans and correlation IDs.
5. **Agent-Native Interfaces Fifth**  
   Add MCP server capabilities for internal tools/resources with strict tenant scoping.

## Standards Direction (2026) for This Product Type

- **Modular monolith + durable workflow engine** is the dominant practical path for enterprise agent platforms (faster than early microservices, safer than request-bound async jobs).
- **Database-enforced multitenancy (RLS)** is table stakes; app-only tenant filtering is no longer acceptable.
- **Policy-as-code control planes** are becoming default for enterprise authorization/governance.
- **MCP-compatible tool ecosystems** are becoming the interoperability baseline for agent platforms.
- **OTel + GenAI telemetry** is the operations standard, even as GenAI conventions are still stabilizing.

## What To Avoid

- Running fulfillment/policy-heavy jobs only inside synchronous route handlers.
- Relying only on app-layer tenant filters without DB-enforced isolation.
- Coupling authorization rules directly inside business logic files.
- Introducing Kafka or microservices before durable orchestration and isolation are solved.

## Confidence

| Area | Confidence | Notes |
|---|---|---|
| Core web/data stack direction | HIGH | Consistent with current codebase and mature platform patterns |
| Multitenant isolation via Postgres RLS | HIGH | Backed by official PostgreSQL docs and SaaS guidance |
| Durable orchestration choice (Temporal-first) | MEDIUM | Strong fit for requirements; exact product choice depends on ops budget/team |
| Policy plane direction (OPA first, Cedar optional) | MEDIUM | OPA broadly proven; Cedar path strongest in AWS-managed environments |
| OTel GenAI conventions maturity | HIGH | Official OTel marks GenAI semconv as development/experimental |

## Sources

- PostgreSQL Row Security Policies (official): https://www.postgresql.org/docs/current/ddl-rowsecurity.html  
- OpenTelemetry GenAI semantic conventions (official): https://opentelemetry.io/docs/specs/semconv/gen-ai/  
- Temporal docs (official): https://docs.temporal.io/  
- Open Policy Agent docs (official): https://openpolicyagent.org/docs/latest/  
- Amazon Verified Permissions / Cedar (official): https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html  
- Model Context Protocol docs (official): https://modelcontextprotocol.io/docs/getting-started/intro
