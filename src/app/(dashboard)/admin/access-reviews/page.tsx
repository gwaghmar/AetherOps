import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { accessReviewCampaign } from "@/db/app-schema";
import { eq } from "drizzle-orm";
import { CreateCampaignButton } from "./create-campaign-button";
import { ClipboardCheck, Calendar } from "lucide-react";
import Link from "next/link";

export default async function AccessReviewsPage() {
  const session = await requireSession();
  
  const campaigns = await db.query.accessReviewCampaign.findMany({
    where: eq(accessReviewCampaign.organizationId, session.user.organizationId!),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    with: {
      items: true,
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
            <ClipboardCheck className="h-6 w-6" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Access Reviews</h1>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              Manage quarterly campaigns to re-certify user access.
            </p>
          </div>
        </div>
        <CreateCampaignButton />
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--line)" }}>
            <ClipboardCheck className="mx-auto h-8 w-8" style={{ color: "var(--ink-3)" }} />
            <h3 className="mt-4 text-sm font-medium">No campaigns found</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
              Start your first access review campaign to certify tenant permissions.
            </p>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const completedItems = campaign.items.filter(i => i.decision !== null).length;
            const totalItems = campaign.items.length;
            const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;
            const isCompleted = campaign.status === "completed" || (totalItems > 0 && completedItems === totalItems);
            
            return (
              <div
                key={campaign.id}
                className="flex flex-col justify-between gap-4 rounded-lg border p-6 shadow-sm transition-all sm:flex-row sm:items-center"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{campaign.title}</h3>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={isCompleted
                        ? { background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }
                        : { background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }
                      }
                    >
                      {isCompleted ? "Completed" : "Active"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm" style={{ color: "var(--ink-3)" }}>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due {new Date(campaign.dueDate).toLocaleDateString()}
                    </div>
                    <div>
                      {completedItems} of {totalItems} reviewed
                    </div>
                  </div>
                  <div className="mt-3 w-full overflow-hidden rounded-full sm:w-64" style={{ background: "var(--subtle)" }}>
                    <div 
                      className="h-1.5 rounded-full"
                      style={{ width: `${progress}%`, background: isCompleted ? "var(--status-approved)" : "var(--accent)" }}
                    />
                  </div>
                </div>
                <div>
                  <Link
                    href={`/approvals`}
                    className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                  >
                    View Pending Approvals
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
