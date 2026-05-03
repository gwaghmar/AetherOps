import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { appCatalog } from "@/db/app-schema";
import { eq } from "drizzle-orm";
import { AppRegistryList } from "./app-registry-list";
import { Library } from "lucide-react";

export default async function AppRegistryPage() {
  const session = await requireSession();
  const organizationId = session.user.organizationId!;

  const apps = await db
    .select()
    .from(appCatalog)
    .where(eq(appCatalog.organizationId, organizationId));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="rounded-xl bg-purple-50 p-2 dark:bg-purple-900/20">
          <Library className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base & App Registry</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Define applications in your IT portfolio and ingest vendor documentation to guide AI triage and end-users.
          </p>
        </div>
      </div>

      <AppRegistryList apps={apps} />
    </div>
  );
}
