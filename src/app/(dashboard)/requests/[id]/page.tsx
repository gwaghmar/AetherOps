import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  approval,
  auditEvent,
  request as requestTable,
  requestType,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requestStatusLabel } from "@/lib/status-labels";
import { nextActionGuidance } from "@/lib/next-action";
import { formatAbsoluteDate } from "@/lib/format-date";
import { isApproverAllowedForRequest } from "@/server/approval-routing";
import { RequestVisitTracker } from "@/components/request-visit-tracker";
import { ApproverSummaryPanel } from "@/components/approver-summary-panel";
import { TriageBadge } from "@/components/triage-badge";
import { ApproverRecommendation } from "@/components/approver-recommendation";
import { ApprovalPanel } from "./approval-panel";
import { NeedsInfoResubmit } from "./needs-info-resubmit";
import { WorkflowVisualizer } from "@/components/workflow-visualizer";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const orgId = session.user.organizationId;
  if (!orgId) notFound();

  const [row] = await db
    .select({
      request: requestTable,
      typeTitle: requestType.title,
      typeFieldSchema: requestType.fieldSchema,
      requesterEmail: user.email,
      requesterName: user.name,
      requesterDepartment: user.department,
      requesterManagerUserId: user.managerUserId,
    })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .innerJoin(user, eq(requestTable.requesterId, user.id))
    .where(
      eq(requestTable.id, id),
    )
    .limit(1);

  if (!row || row.request.organizationId !== orgId) notFound();

  let managerName: string | null = null;
  let managerEmail: string | null = null;
  if (row.requesterManagerUserId) {
    const [mgr] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(
        and(
          eq(user.id, row.requesterManagerUserId),
          eq(user.organizationId, orgId),
        ),
      )
      .limit(1);
    managerName = mgr?.name ?? null;
    managerEmail = mgr?.email ?? null;
  }

  const role = session.user.role;
  const isRequester = row.request.requesterId === session.user.id;
  const isApprover = role === "approver" || role === "admin";
  const awaitingDecision =
    row.request.status === "pending_approval" ||
    row.request.status === "needs_info";
  const canApprove =
    isApprover &&
    awaitingDecision &&
    (role === "admin" ||
      isApproverAllowedForRequest({
        approverUserId: session.user.id,
        routingApproverIds: row.request.routingApproverIds ?? null,
        assignedApproverId: row.request.assignedApproverId,
      }));

  const canView = isRequester || isApprover;
  if (!canView) notFound();

  const canResubmitInfo =
    isRequester && row.request.status === "needs_info";

  // Resolve assigned approver email for guidance banner
  let assignedApproverEmail: string | null = null;
  if (row.request.assignedApproverId) {
    const [approverRow] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, row.request.assignedApproverId))
      .limit(1);
    assignedApproverEmail = approverRow?.email ?? null;
  }

  const guidance = nextActionGuidance({
    status: row.request.status,
    isRequester,
    isApprover: canApprove,
    approverEmail: assignedApproverEmail,
  });

  const events = await db
    .select()
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.organizationId, orgId),
        eq(auditEvent.entityType, "request"),
        eq(auditEvent.entityId, id),
      ),
    )
    .orderBy(asc(auditEvent.createdAt));

  const decisions = await db
    .select()
    .from(approval)
    .where(eq(approval.requestId, id))
    .orderBy(asc(approval.decidedAt));

  return (
    <div className="space-y-8">
      {isRequester ? <RequestVisitTracker requestId={id} /> : null}
      <div>
        <Link
          href="/"
          className="text-xs font-medium hover:opacity-70"
          style={{ color: "var(--ink-3)" }}
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Request</h1>
        <p className="mt-1 font-mono text-xs" style={{ color: "var(--ink-3)" }}>{id}</p>
      </div>

      {row.request.status === "revocation_pending" && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--status-pending) 30%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }}>
          <p className="font-semibold">Access revocation in progress</p>
          <p className="mt-0.5 text-[13px] opacity-90">
            This access has expired and is being automatically revoked. No action required.
          </p>
        </div>
      )}

      {row.request.status === "revocation_failed" && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--status-denied) 30%, transparent)", background: "color-mix(in srgb, var(--status-denied) 8%, transparent)", color: "var(--status-denied)" }}>
          <p className="font-semibold">Revocation failed</p>
          <p className="mt-0.5 text-[13px] opacity-90">
            Automatic revocation failed after multiple attempts. Contact your IT administrator to revoke access manually.
          </p>
        </div>
      )}

      {row.request.status === "fulfilled" && row.request.expiresAt && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={row.request.expiresAt <= new Date()
            ? { borderColor: "color-mix(in srgb, var(--status-denied) 30%, transparent)", background: "color-mix(in srgb, var(--status-denied) 8%, transparent)", color: "var(--status-denied)" }
            : { borderColor: "color-mix(in srgb, var(--status-pending) 30%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }
          }
        >
          <p className="font-semibold">
            {row.request.expiresAt <= new Date() ? "Access expired" : "Time-bound access"}
          </p>
          <p className="mt-0.5 text-[13px] opacity-90">
            Expires: <span className="font-mono">{formatAbsoluteDate(row.request.expiresAt)}</span>
            {row.request.preExpiryNotifiedAt && (
              <span className="ml-2 text-xs opacity-75">(notification sent)</span>
            )}
          </p>
        </div>
      )}

      {guidance && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={
            guidance.tone === "action"
              ? { borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }
              : guidance.tone === "warn"
                ? { borderColor: "color-mix(in srgb, var(--status-pending) 30%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }
                : guidance.tone === "done"
                  ? { borderColor: "color-mix(in srgb, var(--status-approved) 30%, transparent)", background: "color-mix(in srgb, var(--status-approved) 8%, transparent)", color: "var(--status-approved)" }
                  : { borderColor: "var(--line)", background: "var(--subtle)", color: "var(--ink-2)" }
          }
        >
          <p className="font-semibold">{guidance.label}</p>
          <p className="mt-0.5 text-[13px] opacity-90">{guidance.detail}</p>
        </div>
      )}

      <section
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--subtle)" }}
          >
            {requestStatusLabel(row.request.status)}
          </span>
          <span className="text-sm" style={{ color: "var(--ink-3)" }}>{row.typeTitle}</span>
          {row.request.aiTriageRisk && (
            <TriageBadge
              risk={row.request.aiTriageRisk}
              reason={row.request.aiTriageReason}
            />
          )}
          {isRequester && row.request.status === "fulfilled" && row.request.expiresAt && (
            <Link
              href={`/requests/new?typeId=${row.request.requestTypeId}&${new URLSearchParams(
                Object.entries(row.request.payload as Record<string, string>)
              ).toString()}`}
              className="ml-auto rounded-lg border px-3 py-1 text-xs font-medium hover:opacity-80"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            >
              Renew Access
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Requester: {row.requesterName} ({row.requesterEmail})
          {row.requesterDepartment ? (
            <span className="block text-xs" style={{ color: "var(--ink-3)" }}>
              Department: {row.requesterDepartment}
            </span>
          ) : null}
          {managerName ? (
            <span className="block text-xs" style={{ color: "var(--ink-3)" }}>
              Reports to: {managerName}
              {managerEmail ? ` (${managerEmail})` : null}
            </span>
          ) : null}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {Object.entries(row.request.payload as Record<string, unknown>).map(
            ([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                  {k}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{String(v)}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--ink-3)" }}>Workflow Status</h2>
        <WorkflowVisualizer request={row.request} />
      </section>

      {canApprove && (
        <div className="space-y-4">
          <ApproverRecommendation
            requestId={id}
            organizationId={orgId}
            requestTypeId={row.request.requestTypeId}
          />
          <ApproverSummaryPanel requestId={id} />
          <ApprovalPanel requestId={id} />
        </div>
      )}

      {canResubmitInfo && (
        <NeedsInfoResubmit
          requestId={id}
          fieldSchema={row.typeFieldSchema}
          initialPayload={row.request.payload as Record<string, unknown>}
        />
      )}

      {decisions.length > 0 && (
        <section>
          <h2 className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Decisions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="font-medium capitalize">
                  {d.approverId ? d.decision : `${d.decision} (AI auto-approved)`}
                </span>
                {d.comment && (
                  <span style={{ color: "var(--ink-2)" }}>
                    {" "}
                    — {d.comment}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Audit trail</h2>
        <ul
          className="mt-2 divide-y rounded-lg border"
          style={{ borderColor: "var(--line)", "--tw-divide-opacity": "1" } as React.CSSProperties}
        >
          {events.map((e) => (
            <li key={e.id} className="px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
              <time
                dateTime={e.createdAt?.toISOString?.() ?? undefined}
                title={e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                className="text-xs"
                style={{ color: "var(--ink-3)" }}
              >
                {e.createdAt
                  ? new Date(e.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </time>
              <div className="font-medium">{e.action}</div>
              {e.metadata && (
                <pre
                  tabIndex={0}
                  aria-label="Event metadata"
                  className="mt-1 max-h-32 overflow-auto text-xs"
                  style={{ color: "var(--ink-2)" }}
                >
                  {JSON.stringify(e.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
