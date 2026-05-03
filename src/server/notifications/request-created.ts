import { eq } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, requestType, user } from "@/db/schema";
import {
  createEmailApprovalToken,
  emailApprovalTokensEnabled,
} from "@/lib/approval-email-token";
import { getPublicAppName, getPublicAppUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/server/email/send-email";
import { sendSlackApprovalMessage } from "./slack";

export async function sendRequestCreatedNotifications(input: {
  requestId: string;
  organizationId: string;
  requestTypeSlug: string;
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  requesterDepartment: string | null;
  requesterManagerUserId: string | null;
  approverUserIds: string[];
  reviewUrl: string;
}): Promise<void> {
  const appName = getPublicAppName();
  const base = getPublicAppUrl().replace(/\/$/, "");
  const emailBase = `${base}/email-approval`;

  const [meta] = await db
    .select({ title: requestType.title })
    .from(requestTable)
    .innerJoin(requestType, eq(requestTable.requestTypeId, requestType.id))
    .where(eq(requestTable.id, input.requestId))
    .limit(1);

  const typeTitle =
    meta?.title ?? input.requestTypeSlug.replace(/_/g, " ");

  let managerBlock = "";
  if (input.requesterManagerUserId) {
    const [mgr] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, input.requesterManagerUserId))
      .limit(1);
    if (mgr) {
      managerBlock = `<p><strong>Reports to:</strong> ${escapeHtml(mgr.name)} (${escapeHtml(mgr.email)})</p>`;
    }
  }

  const deptBlock = input.requesterDepartment
    ? `<p><strong>Department:</strong> ${escapeHtml(input.requesterDepartment)}</p>`
    : "";

  const [payloadRow] = await db
    .select({ payload: requestTable.payload })
    .from(requestTable)
    .where(eq(requestTable.id, input.requestId))
    .limit(1);

  const payload = (payloadRow?.payload ?? {}) as Record<string, unknown>;
  const payloadLines = Object.entries(payload)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #e4e4e7;"><strong>${escapeHtml(k)}</strong></td><td style="padding:4px 8px;border:1px solid #e4e4e7;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  const summaryHtml = `
  <table style="border-collapse:collapse;margin-top:12px;font-size:14px;">${payloadLines || "<tr><td>No extra fields.</td></tr>"}</table>`;

  const tokensOk = emailApprovalTokensEnabled();

  for (const approverId of input.approverUserIds) {
    const [approver] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, approverId))
      .limit(1);
    if (!approver?.email) continue;

    const approveTok = tokensOk
      ? createEmailApprovalToken({
          requestId: input.requestId,
          approverUserId: approverId,
          action: "approve",
        })
      : null;
    const denyTok = tokensOk
      ? createEmailApprovalToken({
          requestId: input.requestId,
          approverUserId: approverId,
          action: "deny",
        })
      : null;

    const approveUrl = approveTok
      ? `${emailBase}?t=${encodeURIComponent(approveTok)}`
      : null;
    const denyUrl = denyTok
      ? `${emailBase}?t=${encodeURIComponent(denyTok)}`
      : null;

    const buttons =
      approveUrl && denyUrl
        ? `<p style="margin:20px 0;">
  <a href="${approveUrl}" style="display:inline-block;padding:12px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px;">Approve</a>
  <a href="${denyUrl}" style="display:inline-block;padding:12px 20px;background:#fff;color:#b91c1c;border:1px solid #fecaca;text-decoration:none;border-radius:8px;margin-right:8px;">Decline</a>
  <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;padding:12px 20px;background:#f4f4f5;color:#18181b;text-decoration:none;border-radius:8px;">Full review</a>
</p>`
        : `<p style="margin:20px 0;"><a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;padding:12px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;">Open request</a></p>
<p style="font-size:13px;color:#71717a;">One-click approve/decline requires APPROVAL_EMAIL_SECRET (or BETTER_AUTH_SECRET) to be set on the server.</p>`;

    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#18181b;">
<h1 style="font-size:18px;">New request needs your decision</h1>
<p><strong>${escapeHtml(typeTitle)}</strong> · ID <code>${escapeHtml(input.requestId.slice(0, 8))}…</code></p>
<p><strong>Requester:</strong> ${escapeHtml(input.requesterName)} (${escapeHtml(input.requesterEmail)})</p>
${deptBlock}
${managerBlock}
${summaryHtml}
${buttons}
<p style="font-size:12px;color:#71717a;">— ${escapeHtml(appName)}</p>
</body></html>`;

    await sendTransactionalEmail({
      organizationId: input.organizationId,
      to: approver.email,
      subject: `[${appName}] Approve? ${typeTitle} — ${input.requesterName}`,
      html,
    });

    const payloadText = Object.entries(payload)
      .map(([k, v]) => `• *${k}:* ${v}`)
      .join("\n");

    void sendSlackApprovalMessage({
      organizationId: input.organizationId,
      requestId: input.requestId,
      requestTitle: typeTitle,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      managerEmail: approver.email,
      reviewUrl: input.reviewUrl,
      payloadSummary: payloadText || "No extra fields.",
    });
  }

  if (input.requesterEmail) {
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;">
<p>Hi ${escapeHtml(input.requesterName)},</p>
<p>Your request <strong>${escapeHtml(typeTitle)}</strong> was submitted and is waiting for approval.</p>
<p><a href="${escapeHtml(input.reviewUrl)}">Track status</a></p>
<p style="font-size:12px;color:#71717a;">— ${escapeHtml(appName)}</p>
</body></html>`;
    await sendTransactionalEmail({
      organizationId: input.organizationId,
      to: input.requesterEmail,
      subject: `[${appName}] Request submitted — ${typeTitle}`,
      html,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
