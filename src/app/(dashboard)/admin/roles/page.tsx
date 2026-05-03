import { db } from "@/db";
import { roleBundle, requestType, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { RoleBundleList } from "./role-bundle-list";
import { Briefcase } from "lucide-react";

export default async function RolesAdminPage() {
  const session = await requireRole(["admin"]);
  const orgId = session.user.organizationId!;

  const bundles = await db.query.roleBundle.findMany({
    where: eq(roleBundle.organizationId, orgId),
    with: {
      requestTypes: {
        with: {
          requestType: true,
        },
      },
    },
  });

  const availableTypes = await db.query.requestType.findMany({
    where: eq(requestType.organizationId, orgId),
  });

  const allUsers = await db.query.user.findMany({
    where: eq(user.organizationId, orgId),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="rounded-xl bg-blue-50 p-2 dark:bg-blue-900/20">
          <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Bundles & JML</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Define standard access bundles for roles (Engineering, Sales) to automate Joiner/Mover provisioning.
          </p>
        </div>
      </div>

      <RoleBundleList 
        initialBundles={bundles as any} 
        availableTypes={availableTypes as any}
        allUsers={allUsers as any}
      />
    </div>
  );
}
