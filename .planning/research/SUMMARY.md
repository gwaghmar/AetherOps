# Project Research Summary

**Project:** AetherOps  
**Domain:** ServiceNow-style operations platform for AI agents and AI-native companies  
**Researched:** 2026-04-14  
**Confidence:** MEDIUM-HIGH

## Executive Summary

This product should be built as a governance-first, multi-tenant AI operations control plane rather than a broad ITSM clone. Research consistently supports a modular monolith foundation (`Next.js 16`, `TypeScript`, `Postgres`, `Drizzle`, `Better Auth`) with deliberate extraction of high-risk capabilities into dedicated runtime boundaries: durable workflow orchestration, policy decisioning, agent execution mediation, and observability.

The recommended approach is sequence-driven: enforce tenant safety and fail-closed controls first, then add durable orchestration, then centralize policy and execution guardrails before expanding autonomous behavior. This preserves brownfield delivery speed while reducing security and compliance risk as agent autonomy increases.

The primary risks are tenant identity drift across channels, fail-open governance, excessive agent privilege, and silent distributed degradation. Mitigation is explicit and should be release-gating: canonical tenant resolution, default-deny policy behavior, least-privilege execution gateway, idempotent workflow transitions, and end-to-end decision telemetry ("no telemetry, no launch").

## Key Findings

### Stack Direction

Keep the existing app and data core, then add a control-plane layer for durability, policy, and operations.

**Core technologies:**
- `Next.js 16` + `React 19`: operator dashboard and API shell with strong existing fit.
- `TypeScript` + strict contracts + `Zod`: enforce typed boundaries across channels and tools.
- `Postgres 18` + mandatory `RLS` + `Drizzle`: canonical multitenant system of record.
- `Temporal` (preferred): durable workflows, retries, compensation, and long-running approvals.
- `OPA` (primary, Cedar optional): centralized policy-as-code for consistent governance.
- `OpenTelemetry` (+ GenAI semantics pinned): correlated traces, metrics, and audit diagnostics.
- `Redis`: distributed rate-limiting/idempotency primitives for correctness under scale.
- `MCP` support: standardized agent/tool interoperability surface.

### Table-Stakes Features

- End-to-end governed request lifecycle across UI/API/chat/webhook channels.
- Human-in-the-loop approvals for high-risk operations with risk-tiered controls.
- Tenant-safe identity and authorization across all entry points.
- Immutable audit trail with exportable evidence (decision context + policy version).
- Fail-closed policy enforcement with explicit, audited emergency override semantics.
- API-first interoperability with reliable retries, idempotency, and signed callbacks.
- Workflow reliability controls (queueing, rate limiting, deterministic retries).
- Operational observability for workflow, policy, connector, and agent outcomes.

### Differentiators

- Risk-adaptive autonomy engine (dynamic auto-approve vs HITL by policy/risk).
- AI Agent Control Tower for cross-agent governance and monitoring.
- Workspace-aware Slack/Teams command center with strict tenant mapping.
- Policy simulation/dry-run against historical requests before rollout.
- Fulfillment quality feedback loop to improve routing and guardrails over time.
- Org-level catalog intelligence and maturity benchmarking once telemetry is mature.

### Major Risks/Pitfalls

1. **Tenant identity drift across channels** - enforce one tenant resolution contract; fail closed on ambiguity.
2. **Fail-open governance in production** - default deny for policy/approval failures; time-boxed audited override only.
3. **Excessive agent agency** - require execution gateway, scoped entitlements, validation, and HITL for high-impact actions.
4. **Integration fragility/silent degradation** - explicit degraded modes, distributed-safe backends, idempotent transitions.
5. **Observability blind to decision quality** - instrument decision traces, safety SLOs, override/denial metrics, and incident runbooks.

## Implications for Roadmap

Based on combined research, recommended phase ordering:

### Phase 1: Tenant Safety and Governance Baseline
**Rationale:** Trust and isolation are prerequisites for all autonomy expansion.  
**Delivers:** Canonical tenant resolution, strict authz hardening, fail-closed defaults, immutable audit chain.  
**Addresses:** Tenant-safe identity, policy fail-closed, audit evidence table stakes.  
**Avoids:** Tenant identity drift and fail-open governance pitfalls.

### Phase 2: Reliability and Durable Workflow Core
**Rationale:** Durable execution must precede broader automation to prevent side-effect drift.  
**Delivers:** Orchestrated retries/compensation, idempotent fulfillment transitions, distributed-safe rate limits/queues.  
**Addresses:** Reliability controls and API/chatops interoperability expectations.  
**Avoids:** Silent degradation and duplicate/non-deterministic fulfillment.

### Phase 3: Policy and Execution Control Plane
**Rationale:** Centralized policy and mediated execution are required before high-risk agent actions.  
**Delivers:** OPA-backed policy decisions, reason-coded denials, agent execution gateway with least privilege and budgets.  
**Addresses:** HITL/risk-tiered approvals and governance consistency across channels.  
**Avoids:** Policy drift and excessive agent privilege.

### Phase 4: Observability and Decision Intelligence
**Rationale:** Safe scaling needs decision-quality telemetry and operational diagnostics, not infra metrics alone.  
**Delivers:** OTel trace correlation, policy/connector diagnostics, AI-native SLOs, audit-to-incident reconstruction.  
**Addresses:** Ops observability table stake; enables safe rollout and continuous tuning.  
**Avoids:** Untraceable failures and weak post-incident attribution.

### Phase 5: Differentiator Expansion
**Rationale:** Competitive features should ship after safety, reliability, and telemetry foundations are stable.  
**Delivers:** Risk-adaptive autonomy, chat command center depth, policy simulation, feedback loop; defer benchmarking/control-tower UX until instrumentation is proven.  
**Addresses:** Differentiator set with controlled blast radius.  
**Avoids:** Premature high-surface complexity and brittle feature sprawl.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Durable workflow engine decision and migration shape (`Temporal` operational trade-offs).
- **Phase 3:** Policy engine deployment model and performance strategy (`OPA` + inline expression split).
- **Phase 5:** Control-tower architecture, policy simulation UX, and feedback-loop modeling details.

Phases with standard patterns (can skip deep research-phase):
- **Phase 1:** Multitenant hardening + fail-closed authz patterns are well-established.
- **Phase 4:** OTel-based trace/log/metric rollout patterns are mature and widely documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong alignment with current codebase and official platform guidance (Postgres, OTel, Temporal, OPA). |
| Features | MEDIUM-HIGH | Table stakes are consistent across enterprise AI ops trends; differentiators are directionally strong but product-specific. |
| Architecture | HIGH | Modular control-plane evolution is well supported by durable workflow/policy architecture patterns. |
| Pitfalls | HIGH | Risks are concrete, repeatedly observed in multi-tenant and agentic systems, and mapped to actionable mitigations. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Policy stack finalization:** Confirm OPA-only vs OPA+Cedar based on deployment environment and team operations profile.
- **Workflow runtime economics:** Validate Temporal Cloud vs self-hosted/alternative against expected load and budget.
- **Agent control-tower scope:** Define MVP boundary to avoid overbuilding before telemetry maturity.
- **Source confidence mix for some feature trends:** Validate vendor-influenced differentiator claims during phase-level planning.

## Sources

### Primary (HIGH confidence)
- PostgreSQL RLS docs: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- OpenTelemetry docs: https://opentelemetry.io/docs/
- OpenTelemetry GenAI semconv: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- Temporal docs: https://docs.temporal.io/
- OPA docs: https://openpolicyagent.org/docs/latest/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- OWASP Top 10 for LLM Apps: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- MCP docs: https://modelcontextprotocol.io/docs/getting-started/intro

### Secondary (MEDIUM confidence)
- ServiceNow AI platform direction (newsroom + product pages)
- CIO/LogicMonitor/Strata references on enterprise HITL and autonomous workflow operations
- ServiceNow community governance post

---
*Research completed: 2026-04-14*  
*Ready for roadmap: yes*
