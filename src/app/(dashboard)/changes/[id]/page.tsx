import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  auditEvent,
  changeTicket,
  changeTemplate,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import {
  nextChangeTicketStage,
  STAGE_LABELS,
  isChangeTicketStage,
  type ChangeTicketStage,
} from "@/lib/change-ticket-stages";
import { ChangeTicketPanel } from "./change-ticket-panel";

export const dynamic = "force-dynamic";

function advanceButtonLabel(stage: ChangeTicketStage): string | null {
  const next = nextChangeTicketStage(stage);
  if (!next) return null;
  if (stage === "on_deck") return "Start Prelim UAT";
  if (next === "closed") return "Approve release & close";
  return `Advance to ${STAGE_LABELS[next]}`;
}

export default async function ChangeTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const orgId = session.user.organizationId;
  if (!orgId) notFound();

  const uid = session.user.id;
  const role = session.user.role as "requester" | "approver" | "admin";

  const [row] = await db
    .select({
      ticket: changeTicket,
      templateTitle: changeTemplate.title,
      templateFieldSchema: changeTemplate.fieldSchema,
      requesterEmail: user.email,
      requesterName: user.name,
    })
    .from(changeTicket)
    .innerJoin(
      changeTemplate,
      eq(changeTicket.changeTemplateId, changeTemplate.id),
    )
    .innerJoin(user, eq(changeTicket.requesterId, user.id))
    .where(
      and(eq(changeTicket.id, id), eq(changeTicket.organizationId, orgId)),
    )
    .limit(1);

  if (!row) notFound();

  const { ticket, templateTitle, templateFieldSchema, requesterEmail, requesterName } =
    row;

  if (!isChangeTicketStage(ticket.stage)) notFound();
  const stage = ticket.stage as ChangeTicketStage;

  const isOwner = ticket.requesterId === uid;
  const isAssignee = ticket.assignedUserId === uid;
  const isStaff = role === "approver" || role === "admin";
  const canView = isOwner || isStaff || isAssignee;
  if (!canView) notFound();

  const members = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
    })
    .from(user)
    .where(eq(user.organizationId, orgId))
    .orderBy(asc(user.email));

  const events = await db
    .select()
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.organizationId, orgId),
        eq(auditEvent.entityType, "change_ticket"),
        eq(auditEvent.entityId, id),
      ),
    )
    .orderBy(asc(auditEvent.createdAt));

  const advanceLabel = advanceButtonLabel(stage);
  const canAdvance =
    isStaff && stage !== "draft" && stage !== "closed" && advanceLabel !== null;
  const canMoveToDeck =
    stage === "draft" && (isOwner || role === "admin");
  const canEditDraft = stage === "draft" && (isOwner || role === "admin");
  const canUpdateAssignee =
    stage !== "closed" && (isOwner || isStaff);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/changes"
          className="text-xs font-medium hover:opacity-70"
          style={{ color: "var(--ink-3)" }}
        >
          ← Change releases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {ticket.title}
        </h1>
        <p className="mt-1 font-mono text-xs" style={{ color: "var(--ink-3)" }}>{id}</p>
      </div>

      <section
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--subtle)" }}
          >
            {STAGE_LABELS[stage]}
          </span>
          <span className="text-sm" style={{ color: "var(--ink-3)" }}>{templateTitle}</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Requester: {requesterName} ({requesterEmail})
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {Object.entries(ticket.payload).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                {k}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ChangeTicketPanel
        ticketId={ticket.id}
        stage={stage}
        title={ticket.title}
        payload={ticket.payload}
        fieldSchemaJson={templateFieldSchema}
        members={members}
        assigneeId={ticket.assignedUserId}
        advanceLabel={advanceLabel}
        canAdvance={canAdvance}
        canMoveToDeck={canMoveToDeck}
        canEditDraft={canEditDraft}
        canUpdateAssignee={canUpdateAssignee}
      />

      <section>
        <h2 className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>Audit trail</h2>
        <ul
          className="mt-2 divide-y rounded-lg border"
          style={{ borderColor: "var(--line)" }}
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
