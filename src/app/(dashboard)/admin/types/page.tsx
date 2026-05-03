import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { request as requestTable, requestType } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { AdminCatalogCopilot } from "@/components/admin-catalog-copilot";
import { DeleteTypeButton } from "./delete-type-button";
import { RequestTypeForm } from "./request-type-form";

export default async function AdminTypesPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p className="text-red-600">Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p className="text-red-600">No organization.</p>;

  const types = await db
    .select()
    .from(requestType)
    .where(eq(requestType.organizationId, orgId))
    .orderBy(desc(requestType.createdAt));

  const usageRows = await db
    .select({
      requestTypeId: requestTable.requestTypeId,
      n: count(),
    })
    .from(requestTable)
    .where(eq(requestTable.organizationId, orgId))
    .groupBy(requestTable.requestTypeId);
  const usageByTypeId = new Map(
    usageRows.map((r) => [r.requestTypeId, Number(r.n)] as const),
  );

  return (
    <>
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request catalog</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create and edit intent templates. Slug must be unique per org; use
          lowercase letters, numbers, underscores, hyphens.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          New type
        </h2>
        <RequestTypeForm mode="create" />
      </section>

      <ul className="space-y-4">
        {types.map((t) => {
          const requestCount = usageByTypeId.get(t.id) ?? 0;
          const archived = Boolean(t.archivedAt);
          return (
          <li
            key={t.id}
            className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-medium">{t.title}</span>
                <span className="ml-2 text-xs text-zinc-500">({t.slug})</span>
                {archived ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                    Archived
                  </span>
                ) : null}
              </div>
              <DeleteTypeButton
                id={t.id}
                slug={t.slug}
                requestCount={requestCount}
                archived={archived}
              />
            </div>
            {t.description && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t.description}
              </p>
            )}
            <details className="mt-2.5">
              <summary className="cursor-pointer text-sm font-medium text-zinc-600">
                Edit
              </summary>
              <RequestTypeForm
                mode="edit"
                initial={{
                  id: t.id,
                  slug: t.slug,
                  title: t.title,
                  description: t.description,
                  fieldSchema: t.fieldSchema,
                  riskDefaults: t.riskDefaults,
                  connectorId: t.connectorId,
                }}
              />
            </details>
          </li>
          );
        })}
      </ul>
    </div>
    <AdminCatalogCopilot />
    </>
  );
}
