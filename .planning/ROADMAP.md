# Roadmap: AetherOps

**Generated:** 2026-04-14  
**Granularity:** fine  
**Delivery mode:** Brownfield evolution (no rewrite)

## Phases

- [x] **Phase 1: Canonical Tenant Resolution** - Normalize tenant identity across UI, API, Slack, and webhook channels with fail-closed behavior.
- [x] **Phase 2: Org Authorization and Governance Safety** - Enforce least-privilege access and policy-driven approval controls with audited overrides.
- [x] **Phase 3: Idempotent Lifecycle Transitions** - Make request creation, approvals, and fulfillment transitions retry-safe and deterministic.
- [x] **Phase 4: Distributed Runtime Reliability** - Harden shared rate limiting and webhook delivery reliability for multi-instance deployments.
- [x] **Phase 5: API and Agent Execution Guardrails** - Stabilize external contracts and secure agent/API action execution boundaries.
- [x] **Phase 6: Audit and Operational Observability** - Deliver immutable evidence, exportability, and correlated diagnostics for operators.
- [x] **Phase 7: Automation UX and AI-Triage Experience** - Improve request submission, triage guidance, and status clarity without bypassing governance.

## Phase Details

### Phase 1: Canonical Tenant Resolution
**Goal**: Every inbound workflow resolves to one verified organization before any request data access or mutation occurs.
**Depends on**: Nothing (first phase)
**Requirements**: TNTY-01, TNTY-02, TNTY-04
**Success Criteria** (what must be TRUE):
  1. Requests created from UI, API, Slack, and webhooks are each tied to exactly one organization.
  2. Ambiguous or unknown tenant context returns explicit fail-closed errors and does not process request actions.
  3. Slack/ChatOps interactions cannot read or mutate request data unless workspace-to-org mapping is validated first.
**Plans**: 2 plans
- [ ] `01-PLAN-01.md` — Schema (`slack_team_id`), blocking `drizzle-kit push`, `tenant-resolution.ts`, unit tests (TNTY-01, TNTY-02).
- [ ] `01-PLAN-02.md` — Slack slash + chat ingest wiring + admin Slack Team ID field (TNTY-01, TNTY-02, TNTY-04).

### Phase 2: Org Authorization and Governance Safety
**Goal**: Access and policy decisions are fail-closed, role-scoped, and auditable for high-impact operations.
**Depends on**: Phase 1
**Requirements**: TNTY-03, GOV-01, GOV-02, GOV-03, GOV-04
**Success Criteria** (what must be TRUE):
  1. Requester, approver, and admin actions are enforced with org-scoped least-privilege permissions.
  2. In production, policy outages or invalid policy responses deny protected actions by default.
  3. High-impact actions require human approval when policy/risk rules indicate HITL is mandatory.
  4. Emergency override is available only with explicit reason metadata, strict time bounds, and recorded audit context.
  5. Each policy decision stores policy version, decision reason, and actor context for later review.
**Plans**: TBD

### Phase 3: Idempotent Lifecycle Transitions
**Goal**: Core request lifecycle steps remain consistent under retries and partial failures.
**Depends on**: Phase 2
**Requirements**: RLY-01, RLY-02
**Success Criteria** (what must be TRUE):
  1. Replayed request creation or approval submissions do not create duplicate lifecycle side effects.
  2. Fulfillment retries follow deterministic behavior so repeated attempts converge to one consistent final state.
  3. Transient connector failures trigger bounded retry/compensation flows instead of leaving requests in undefined states.
**Plans**: TBD

### Phase 4: Distributed Runtime Reliability
**Goal**: Reliability behavior remains correct across horizontally scaled deployments and external callback failures.
**Depends on**: Phase 3
**Requirements**: RLY-03, RLY-04
**Success Criteria** (what must be TRUE):
  1. Rate limits behave consistently across instances using shared backend primitives.
  2. Platform never silently falls back to per-instance throttling when distributed limit dependencies degrade.
  3. Webhook deliveries retry with bounded backoff and record terminal failure events when delivery exhausts retries.
**Plans**: TBD

### Phase 5: API and Agent Execution Guardrails
**Goal**: External and agent-driven interactions use stable contracts plus strict authn/authz and action controls.
**Depends on**: Phase 4
**Requirements**: API-01, API-02, API-03, API-04
**Success Criteria** (what must be TRUE):
  1. External clients can create and query requests through versioned, validated API contracts.
  2. Programmatic ingestion rejects invalid auth, missing org context, or malformed request payloads.
  3. Agent-initiated actions execute only within scoped allowlists and assigned permissions.
  4. Integration calls requiring trust validation verify signatures/secrets before processing.
**Plans**: TBD

### Phase 6: Audit and Operational Observability
**Goal**: Operators can trace, export, and diagnose request/policy/fulfillment behavior with complete evidence.
**Depends on**: Phase 5
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. Every request lifecycle step is captured as immutable audit evidence with actor identity and timestamp.
  2. Operators can export decision and fulfillment history for compliance review without ad hoc database access.
  3. Correlated telemetry exists across request, policy, and fulfillment paths for incident triage.
  4. Failed automations can be diagnosed from linked request, policy, and connector evidence in one workflow.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Automation UX and AI-Triage Experience
**Goal**: Requesters and approvers complete workflows faster with clear UI guidance and AI-assisted routing while preserving controls.
**Depends on**: Phase 6
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. Employees can submit valid requests quickly using minimal required fields and clear input guidance.
  2. AI-assisted triage proposes routing/metadata before approval processing and remains reviewable by humans.
  3. Requesters and approvers can always see current status, pending owner, and next required action.
  4. Automation reduces manual handoffs without bypassing governance or approval safeguards.
**Plans**: TBD
**UI hint**: yes

## Progress Table — Milestone 1

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Canonical Tenant Resolution | 2/2 | Complete | Done |
| 2. Org Authorization and Governance Safety | 1/1 | Complete | Done |
| 3. Idempotent Lifecycle Transitions | 1/1 | Complete | Done |
| 4. Distributed Runtime Reliability | 1/1 | Complete | Done |
| 5. API and Agent Execution Guardrails | 1/1 | Complete | Done |
| 6. Audit and Operational Observability | 1/1 | Complete | Done |
| 7. Automation UX and AI-Triage Experience | 1/1 | Complete | Done |

---

## Milestone 2: Production Readiness & Integration Depth

- [x] **Phase 8: Real Connector Execution** - Replace stubs with GitHub and Google Workspace connectors; per-type connector routing.
- [ ] **Phase 9: Time-Bound Access & Auto-Revocation** - Implement temporary access with automatic expiry and revocation.
- [ ] **Phase 10: Slack Interactive Approvals** - Complete Slack Block Kit approve/deny from Slack.
- [ ] **Phase 11: Linear-Grade UI Polish** - Typography, focus rings, navigation, density, dark/light parity.
- [ ] **Phase 12: Access Review & Recertification** - Periodic access review campaigns with compliance export.
- [ ] **Phase 13: Admin Analytics Expansion** - SLA tracking, connector health, AI accuracy metrics.
- [ ] **Phase 14: Joiner/Mover/Leaver Lifecycle** - Starter bundles, role-change delta, offboarding revocation.

## Progress Table — Milestone 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Real Connector Execution | 1/1 | Complete | Done |
| 9. Time-Bound Access & Auto-Revocation | 0/0 | Not started | - |
| 10. Slack Interactive Approvals | 0/0 | Not started | - |
| 11. Linear-Grade UI Polish | 0/0 | Not started | - |
| 12. Access Review & Recertification | 0/0 | Not started | - |
| 13. Admin Analytics Expansion | 0/0 | Not started | - |
| 14. Joiner/Mover/Leaver Lifecycle | 0/0 | Not started | - |
