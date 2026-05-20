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
      <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
          <Briefcase className="h-6 w-6" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Bundles & JML</h1>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Define standard access bundles for roles (Engineering, Sales) to automate Joiner/Mover provisioning.
          </p>
        </div>
      </div>

      <RoleBundleList
        initialBundles={bundles}
        availableTypes={availableTypes}
        allUsers={allUsers}
      />
    </div>
  );
}
