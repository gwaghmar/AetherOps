import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { requestType } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { NewRequestForm, type RequestTypeOption } from "./new-request-form";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ typeId?: string; [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const { typeId: typeIdParam, ...rest } = params;
  
  // Extract field values from query params (e.g. ?access_level=admin)
  const initialValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v) initialValues[k] = v;
  }
  const session = await requireSession();
  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p className="text-red-600">Your account has no organization.</p>;
  }

  const types = await db
    .select()
    .from(requestType)
    .where(
      and(
        eq(requestType.organizationId, orgId),
        isNull(requestType.archivedAt),
      ),
    );

  if (types.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">No request types yet.</p>
        <p className="mt-1">
          Run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">npm run db:seed</code>{" "}
          after migrations, then refresh.
        </p>
      </div>
    );
  }

  const options: RequestTypeOption[] = types.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    fieldSchema: t.fieldSchema,
    riskDefaults: t.riskDefaults,
  }));

  return (
    <NewRequestForm 
      types={options} 
      initialTypeId={typeIdParam ?? null} 
      initialValues={initialValues}
    />
  );
}
