# Integrations: webhooks, email, GCP, Microsoft

## Outbound webhooks

Configure **Admin → Integrations** (`webhook_url` + optional signing secret on `organization`).

Events include:

- **`request.submitted`** — fired when a request is created (pending approval). Payload includes `requestId`, `requestTypeSlug`, requester and approver identifiers, summary fields, and a `reviewUrl` when `NEXT_PUBLIC_APP_URL` is set. Use this to fan out to Slack, Microsoft Teams, or custom automation without waiting for an approval decision.
- **`request.approved`** — after an approval decision is recorded.
- **`provision.started`**, **`provision.succeeded`**, **`provision.failed`** — fulfillment connector lifecycle.

Verify signatures using the same HMAC scheme as other events (see `src/server/webhooks.ts`).

## Email approvals

Set `RESEND_API_KEY` and `EMAIL_FROM` (or rely on dev console logging when unset). `APPROVAL_EMAIL_SECRET` enables signed **Approve** / **Decline** links; approvers confirm on `/email-approval` before the decision is applied. One-time `jti` values are stored in `approval_email_nonce` for replay protection.

## GCP access after approval (customer automation)

Preferred pattern: keep **`PROVISION_CONNECTOR=http_webhook`** and point **`PROVISION_WEBHOOK_URL`** at **your** Cloud Run service or Cloud Function. That handler receives `provision.*` payloads and calls Google Cloud APIs using **Workload Identity Federation**, **GKE Workload Identity**, or **short-lived impersonation** — not long-lived JSON service account keys inside the governance app.

Document in your automation: target project, principal (user email), and IAM role or group membership derived from the request payload. Validate all inputs in your function before calling IAM.

## Microsoft Teams / Outlook

Low-code path: trigger a **Power Automate** flow on an HTTP request from a bridge that receives **`request.submitted`** (or poll if you must). Use “Start and wait for an approval” or post an Adaptive Card, then call back into this app’s APIs or UI only with credentials you control.

Native Outlook actionable messages and Azure Bots require additional tenant registration; start with webhook + Power Automate for most enterprises.

## Slack (deferred)

`POST /api/integrations/slack/interactions` verifies **`SLACK_SIGNING_SECRET`** (Slack signing secret v0 + timestamp skew) and returns **401** if headers/body are missing or invalid; **503** if the secret is not configured; **501** if verification succeeds but handling is not implemented yet. A full implementation would acknowledge under 3s, parse Block Kit actions, and call the same server-side decision path as session and email approvals.
