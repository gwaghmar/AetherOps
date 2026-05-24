# Conversation summary — AetherOps vision

**Purpose:** This file captures the main threads from the working chat that led to [`COMBINED-VISION.md`](./COMBINED-VISION.md) and the research that became AetherOps. It is **not** a transcript; it is a **structured memory** of questions, answers, and decisions.

**Last updated:** 4 April 2026  

---

## 1. Onyx / OpenClaw (early context)

- **Onyx** in your workspace referred to two ideas:
  - A **GitHub repo named `onyx`** holding **your copy of OpenClaw**, pushed from `.agents/onyx-demo-env` style setup (e.g. `ONYX-SETUP.md`: clone OpenClaw → set `origin` → push).
  - In the **Apex Holdings demo**, “Onyx” as the **AI layer** on **Teams + OpenClaw**, extended with skills (e.g. SQL, pipelines) to talk to **Synapse, SQL, Power BI** — with the caveat that **Teams ↔ OpenClaw alone** does not replace building those integrations.

---

## 2. “ServiceNow for AI” — problem and positioning

- **ServiceNow (classic job):** Tickets, workflows, approvals, SLAs, assets/CMDB, integrations — strong on **governance and audit**; UX often **dense**.
- **Your pitch:** Same **spine** (request → approve → fulfill → audit) but **summary-first** for approvers — e.g. *who, what, cost, risk — Approve / Deny* — instead of many-column forms.
- **AI-era twist:** Requests include **human access** *and* **agent-related** asks (tools, keys, scopes, model/route changes) with the same evidence story.
- **Market reality:** No single dominant “ServiceNow-but-only-for-AI” winner; **fragments** exist (ITSM, identity governance, agent control planes, LLM observability). **Gap:** one **unified**, startup-friendly layer is still **underserved** if executed with a **sharp wedge**.
- **Feasibility:** **Buildable**; avoid cloning all of ServiceNow — **depth-first** on one workflow, then expand.
- **Analogies discussed:** “Bicycle for the mind” only in the loose sense of **leverage** — the product is **software + process**, not a physical metaphor. **YC “killer app”** label requires **traction**, not concept alone.

---

## 3. Startups, tickets, and compliance

- Even small teams run **informal tickets** (access, prod, tools); pain spikes with **SOC 2** and **scale**.
- The product should **help with SOC 2–style evidence** (who approved what, when access changed) via **structured history and exports** — without claiming “one-click certification.”

---

## 4. Technical shape (how people use it)

- **Primary:** **Web dashboard** (requester, approver, admin).
- **Secondary:** **Slack / Teams** as thin clients (same backend): notifications, buttons, deep links.
- **Behind the scenes:** **API** for tools/agents to **open** requests (not to self-approve sensitive actions).
- **Stack pattern:** Browser UI → API → **PostgreSQL** + **queue/workers** for provisioning; **append-only audit** events.

---

## 5. Proactive assistant (“they don’t know how to get access”)

- **Desired behavior:** Use **company knowledge** (wiki/docs) to **explain** how access works, then **offer** to create the right ticket: *“Should I file this for you?”*
- **Realistic rules agreed:**
  - Ground answers in **retrieved docs**; if no source, say **unknown** and escalate.
  - Map chat to **admin-defined ticket templates** only — **no inventing** new access types from the model.
  - **Two-step create:** show structured summary → user **confirms** before a row is written.
  - Chat **never** approves or provisions; only the **workflow + connectors** do.
  - Log assistant traces (retrieval IDs, proposed payload) for **debugging and governance**.
  - Optional **LLM observability** (e.g. Langfuse-class tools) for the assistant path.

---

## 6. Research deliverable (`COMBINED-VISION.md`)

- Built from **public** sources only; labeled **Verified (public)** vs **Inferred** where needed.
- **Part A:** Competitors — e.g. **AxonFlow, APAAI, AgentGov, Clutch, Govyn, Waxell** (agent lane); **Lumos, ConductorOne, Opal** (access lane); adjacent ITSM/observability/workflow tools.
- **Part B:** How vendors are “made” — published architectures vs typical patterns.
- **Part C:** **Your** merged spec — surfaces, intake, approval cards, routing, provisioning, audit, mermaid flow.
- **Part D:** Recommended **MVP stack** (Next.js, Zod, Postgres, queues, AI guardrails).
- **Part E:** **Proactive helper** — production guardrails (above).
- **Part F:** **Open-source catalog by layer** — **3–5 options per layer** (UI, API, auth, DB, queues, workflows, policy, ReBAC, search, vectors, LLM observability, Slack/Teams, audit, ITSM references); **original research picks** called out in tables; **F.15** stack paths; **license caveats** (AGPL, GPL, Elastic family).
- **Realism review (chat):** Vision is **realistic** if **phased**; **fix** = narrow v1, avoid OSS sprawl, connectors + testing are the long-term work; legal review for copyleft DBs.

---

## 7. Files in this folder

| File | Role |
|------|------|
| [`COMBINED-VISION.md`](./COMBINED-VISION.md) | Full research pack + product spec + OSS catalog. |
| [`CONVERSATION-SUMMARY.md`](./CONVERSATION-SUMMARY.md) | This file — chat themes and decisions. |

*(Plan file under `.cursor/plans/` was used to author the pack; it was **not** modified per your instructions.)*

---

## 8. Open threads (for later sessions)

- **ICP lock:** first buyer (e.g. Series A SaaS eng leader vs security vs AI startup).
- **v1 connector set:** which 2–3 systems prove the wedge (Okta, GitHub, AWS slice, etc.).
- **Legal:** which OSS is **reference-only** vs **embedded** (AGPL/GPU/SSPL).

---

*End of conversation summary.*
