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
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-900/20">
            <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Access Reviews</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Manage quarterly campaigns to re-certify user access.
            </p>
          </div>
        </div>
        <CreateCampaignButton />
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-800">
            <ClipboardCheck className="mx-auto h-8 w-8 text-zinc-400" />
            <h3 className="mt-4 text-sm font-medium">No campaigns found</h3>
            <p className="mt-1 text-sm text-zinc-500">
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
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{campaign.title}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      isCompleted 
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                        : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
                    }`}>
                      {isCompleted ? "Completed" : "Active"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due {new Date(campaign.dueDate).toLocaleDateString()}
                    </div>
                    <div>
                      {completedItems} of {totalItems} reviewed
                    </div>
                  </div>
                  <div className="mt-3 w-full overflow-hidden rounded-full bg-zinc-100 sm:w-64 dark:bg-zinc-800">
                    <div 
                      className={`h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div>
                  <Link
                    href={`/approvals`}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
