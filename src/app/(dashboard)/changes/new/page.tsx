import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { changeTemplate, user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { NewChangeForm } from "./new-change-form";

export const dynamic = "force-dynamic";

export default async function NewChangePage() {
  const session = await requireSession();
  const orgId = session.user.organizationId;
  if (!orgId) {
    return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;
  }

  const templates = await db
    .select()
    .from(changeTemplate)
    .where(eq(changeTemplate.organizationId, orgId))
    .orderBy(asc(changeTemplate.title));

  const members = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
    })
    .from(user)
    .where(eq(user.organizationId, orgId))
    .orderBy(asc(user.email));

  return (
    <NewChangeForm
      templates={templates}
      members={members}
    />
  );
}
