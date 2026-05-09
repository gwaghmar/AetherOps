import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { changeTemplate } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { ChangeTemplateForm } from "./change-template-form";
import { DeleteChangeTemplateButton } from "./delete-change-template-button";

export default async function AdminChangeTemplatesPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;

  const templates = await db
    .select()
    .from(changeTemplate)
    .where(eq(changeTemplate.organizationId, orgId))
    .orderBy(desc(changeTemplate.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Change templates
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Define structured fields for report changes, ETL updates, and other
          release work. Slug must be unique per org.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          New template
        </h2>
        <ChangeTemplateForm mode="create" />
      </section>

      <ul className="space-y-6">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-medium">{t.title}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--ink-3)" }}>({t.slug})</span>
              </div>
              <DeleteChangeTemplateButton id={t.id} slug={t.slug} />
            </div>
            {t.description && (
              <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
                {t.description}
              </p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Edit
              </summary>
              <ChangeTemplateForm
                mode="edit"
                initial={{
                  id: t.id,
                  slug: t.slug,
                  title: t.title,
                  description: t.description,
                  fieldSchema: t.fieldSchema,
                }}
              />
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
