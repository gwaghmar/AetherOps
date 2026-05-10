import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, requestType, user } from "@/db/schema";
import { verifyEmailApprovalToken } from "@/lib/approval-email-token";
import { getPublicAppName } from "@/lib/env";
import { EmailApprovalConfirm } from "./email-approval-confirm";

export const dynamic = "force-dynamic";

export default async function EmailApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const appName = getPublicAppName();

  if (!t?.trim()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-sm" style={{ color: "var(--ink-2)" }}>
        <p>Missing approval link. Open the link from your email.</p>
      </div>
    );
  }

  const verified = verifyEmailApprovalToken(t);
  if (!verified.ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-sm" style={{ color: "var(--status-denied)" }}>
        <p>{verified.error}</p>
      </div>
    );
  }

  const { requestId, approverUserId, action } = verified.payload;

  const [row] = await db
    .select({
      request: requestTable,
      typeTitle: requestType.title,
      requesterName: user.name,
      requesterEmail: user.email,
      requesterDept: user.department,
    })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .innerJoin(user, eq(requestTable.requesterId, user.id))
    .where(eq(requestTable.id, requestId))
    .limit(1);

  if (!row) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-sm" style={{ color: "var(--status-denied)" }}>
        <p>Request not found.</p>
      </div>
    );
  }

  if (row.request.requesterId === approverUserId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-sm" style={{ color: "var(--status-denied)" }}>
        <p>Invalid approver for this link.</p>
      </div>
    );
  }

  const [approver] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, approverUserId))
    .limit(1);

  if (!approver) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-sm" style={{ color: "var(--status-denied)" }}>
        <p>Approver account not found.</p>
      </div>
    );
  }

  const reviewUrl = `/requests/${requestId}`;
  const extraLines: string[] = [
    `Reference: ${requestId.slice(0, 8)}…`,
    approver.email ? `Signed in context: ${approver.email}` : "",
    row.requesterDept ? `Requester department: ${row.requesterDept}` : "",
  ].filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--ink)" }}>
      <div className="mx-auto max-w-md px-4 py-12">
        <p className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>{appName}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {action === "approve" ? "Approve request" : "Decline request"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Confirm you want to record this decision. If you need more context,
          use full review first.
        </p>
        <div className="mt-8 rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <EmailApprovalConfirm
            token={t}
            isApprove={action === "approve"}
            typeTitle={row.typeTitle}
            requesterLine={`${row.requesterName} (${row.requesterEmail})`}
            extraLines={extraLines}
          />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link
            href={reviewUrl}
            className="underline"
            style={{ color: "var(--ink-2)" }}
          >
            Open full review (sign in)
          </Link>
        </p>
      </div>
    </div>
  );
}
