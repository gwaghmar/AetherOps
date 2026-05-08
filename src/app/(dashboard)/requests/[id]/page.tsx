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
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Request</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{id}</p>
      </div>

      {row.request.status === "revocation_pending" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Access revocation in progress</p>
          <p className="mt-0.5 text-[13px] opacity-90">
            This access has expired and is being automatically revoked. No action required.
          </p>
        </div>
      )}

      {row.request.status === "revocation_failed" && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          <p className="font-semibold">Revocation failed</p>
          <p className="mt-0.5 text-[13px] opacity-90">
            Automatic revocation failed after multiple attempts. Contact your IT administrator to revoke access manually.
          </p>
        </div>
      )}

      {row.request.status === "fulfilled" && row.request.expiresAt && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          row.request.expiresAt <= new Date()
            ? "border-red-200 bg-red-50/80 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
            : "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        }`}>
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
          className={`rounded-xl border px-4 py-3 text-sm ${
            guidance.tone === "action"
              ? "border-cyan-200 bg-cyan-50/80 text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100"
              : guidance.tone === "warn"
                ? "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                : guidance.tone === "done"
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
                  : "border-zinc-200 bg-zinc-50/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300"
          }`}
        >
          <p className="font-semibold">{guidance.label}</p>
          <p className="mt-0.5 text-[13px] opacity-90">{guidance.detail}</p>
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
            {requestStatusLabel(row.request.status)}
          </span>
          <span className="text-sm text-zinc-500">{row.typeTitle}</span>
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
              className="ml-auto rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              Renew Access
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Requester: {row.requesterName} ({row.requesterEmail})
          {row.requesterDepartment ? (
            <span className="block text-xs text-zinc-500">
              Department: {row.requesterDepartment}
            </span>
          ) : null}
          {managerName ? (
            <span className="block text-xs text-zinc-500">
              Reports to: {managerName}
              {managerEmail ? ` (${managerEmail})` : null}
            </span>
          ) : null}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {Object.entries(row.request.payload as Record<string, unknown>).map(
            ([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  {k}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{String(v)}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-500 mb-3">Workflow Status</h2>
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
          <h2 className="text-sm font-medium text-zinc-500">Decisions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="font-medium capitalize">
                  {d.approverId ? d.decision : `${d.decision} (AI auto-approved)`}
                </span>
                {d.comment && (
                  <span className="text-zinc-600 dark:text-zinc-400">
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
        <h2 className="text-sm font-medium text-zinc-500">Audit trail</h2>
        <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {events.map((e) => (
            <li key={e.id} className="px-3 py-2 text-sm">
              <time
                dateTime={e.createdAt?.toISOString?.() ?? undefined}
                title={e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                className="text-xs text-zinc-500"
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
                  className="mt-1 max-h-32 overflow-auto text-xs text-zinc-600 dark:text-zinc-400"
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
