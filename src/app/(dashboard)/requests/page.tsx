import { Suspense } from "react";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  request as requestTable,
  requestType,
  user,
} from "@/db/schema";
import { RequestsHub } from "@/components/requests-hub";
import { requireSession } from "@/lib/session";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function RequestsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;
  const cursor = before ? new Date(before) : null;

  const session = await requireSession();
  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p className="text-red-600">Your account has no organization.</p>;
  }

  const role = session.user.role;
  const isAdmin = role === "admin";

  const catalog = await fetchOrgCatalogTiles(orgId);

  const rawRows = await db
    .select({
      id: requestTable.id,
      status: requestTable.status,
      typeTitle: requestType.title,
      assignedApproverId: requestTable.assignedApproverId,
      createdAt: requestTable.createdAt,
      expiresAt: requestTable.expiresAt,
    })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .where(
      cursor
        ? and(
            eq(requestTable.requesterId, session.user.id),
            lt(requestTable.createdAt, cursor),
          )
        : eq(requestTable.requesterId, session.user.id),
    )
    .orderBy(desc(requestTable.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rawRows.length > PAGE_SIZE;
  const pageRows = hasMore ? rawRows.slice(0, PAGE_SIZE) : rawRows;

  const approverIds = [
    ...new Set(
      pageRows
        .map((r) => r.assignedApproverId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const approverRows =
    approverIds.length > 0
      ? await db
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(inArray(user.id, approverIds))
      : [];
  const emailByApproverId = new Map(
    approverRows.map((a) => [a.id, a.email] as const),
  );

  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1]?.createdAt?.toISOString() ?? null
    : null;

  const myRequests = pageRows.map((r) => ({
    id: r.id,
    status: r.status,
    typeTitle: r.typeTitle,
    approverEmail: r.assignedApproverId
      ? (emailByApproverId.get(r.assignedApproverId) ?? null)
      : null,
    expiresAt: r.expiresAt,
  }));

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <RequestsHub
        catalog={catalog}
        requests={myRequests}
        isAdmin={isAdmin}
        now={now}
        listPagination={{
          cursorActive: Boolean(cursor),
          nextBeforeIso: nextCursor,
        }}
      />
    </Suspense>
  );
}
