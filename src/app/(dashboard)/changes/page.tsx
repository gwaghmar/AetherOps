import Link from "next/link";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  changeTicket,
  changeTemplate,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import {
  STAGE_LABELS,
  isChangeTicketStage,
} from "@/lib/change-ticket-stages";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type View = "mine" | "assigned" | "all";

function parseView(v: string | undefined): View {
  if (v === "assigned" || v === "all") return v;
  return "mine";
}

export default async function ChangesListPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; before?: string }>;
}) {
  const session = await requireSession();
  const orgId = session.user.organizationId;
  const uid = session.user.id;
  const role = session.user.role;
  const canSeeAll = role === "approver" || role === "admin";

  const { view: viewParam, before } = await searchParams;
  let view = parseView(viewParam);
  if (view === "all" && !canSeeAll) view = "mine";
  const cursor = before ? new Date(before) : null;

  if (!orgId) {
    return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;
  }

  const conditions = [eq(changeTicket.organizationId, orgId)];

  if (view === "mine") {
    conditions.push(eq(changeTicket.requesterId, uid));
  } else if (view === "assigned") {
    conditions.push(eq(changeTicket.assignedUserId, uid));
  }
  if (cursor) {
    conditions.push(lt(changeTicket.updatedAt, cursor));
  }

  const rawRows = await db
    .select({
      ticket: changeTicket,
      templateTitle: changeTemplate.title,
      assigneeEmail: user.email,
    })
    .from(changeTicket)
    .innerJoin(
      changeTemplate,
      eq(changeTicket.changeTemplateId, changeTemplate.id),
    )
    .leftJoin(user, eq(changeTicket.assignedUserId, user.id))
    .where(and(...conditions))
    .orderBy(desc(changeTicket.updatedAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rawRows.length > PAGE_SIZE;
  const rows = hasMore ? rawRows.slice(0, PAGE_SIZE) : rawRows;
  const nextCursor = hasMore
    ? rows[rows.length - 1]?.ticket.updatedAt?.toISOString()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Change releases</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Governed pipeline: On deck → Prelim UAT → Final UAT → Prod approval →
          Closed.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/changes?view=mine"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
          style={
            view === "mine"
              ? { background: "var(--ink)", color: "var(--ink-on-accent)", borderColor: "var(--ink)" }
              : { background: "var(--surface)", color: "var(--ink-2)", borderColor: "var(--line)" }
          }
        >
          Mine
        </Link>
        <Link
          href="/changes?view=assigned"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
          style={
            view === "assigned"
              ? { background: "var(--ink)", color: "var(--ink-on-accent)", borderColor: "var(--ink)" }
              : { background: "var(--surface)", color: "var(--ink-2)", borderColor: "var(--line)" }
          }
        >
          Assigned to me
        </Link>
        {canSeeAll && (
          <Link
            href="/changes?view=all"
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
            style={
              view === "all"
                ? { background: "var(--ink)", color: "var(--ink-on-accent)", borderColor: "var(--ink)" }
                : { background: "var(--surface)", color: "var(--ink-2)", borderColor: "var(--line)" }
            }
          >
            All
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          No tickets in this view.{" "}
          <Link href="/changes/new" className="font-medium underline">
            New change
          </Link>
        </p>
      ) : (
        <>
          <ul
            className="divide-y rounded-lg border"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {rows.map(({ ticket, templateTitle, assigneeEmail }) => {
              const stageLabel = isChangeTicketStage(ticket.stage)
                ? STAGE_LABELS[ticket.stage]
                : ticket.stage;
              return (
                <li key={ticket.id} style={{ borderColor: "var(--line)" }}>
                  <Link
                    href={`/changes/${ticket.id}`}
                    className="block px-4 py-2.5 transition-colors hover:opacity-80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ background: "var(--subtle)" }}
                      >
                        {stageLabel}
                      </span>
                      <span className="font-medium" style={{ color: "var(--ink)" }}>
                        {ticket.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
                      {templateTitle}
                      {assigneeEmail ? ` · Assignee: ${assigneeEmail}` : ""}
                      {ticket.updatedAt
                        ? ` · Updated ${new Date(ticket.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                        : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {nextCursor && (
            <div className="flex items-center justify-between pt-1">
              {cursor ? (
                <Link
                  href={`/changes?view=${view}`}
                  className="text-sm underline"
                  style={{ color: "var(--ink-3)" }}
                >
                  Back to first page
                </Link>
              ) : (
                <span />
              )}
              <Link
                href={`/changes?view=${view}&before=${encodeURIComponent(nextCursor)}`}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-80"
                style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
              >
                Load older tickets
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
