import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { requestType } from "@/db/schema";

/** Request types visible as catalog tiles for an organization (sorted by title). */
export async function fetchOrgCatalogTiles(organizationId: string) {
  return db
    .select({
      id: requestType.id,
      slug: requestType.slug,
      title: requestType.title,
      description: requestType.description,
      fieldSchema: requestType.fieldSchema,
    })
    .from(requestType)
    .where(
      and(
        eq(requestType.organizationId, organizationId),
        isNull(requestType.archivedAt),
      ),
    )
    .orderBy(asc(requestType.title));
}
