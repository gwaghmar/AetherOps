import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { CreateApiKeyForm } from "./create-api-key-form";
import { RevokeApiKeyButton } from "./revoke-button";

export default async function AdminApiKeysPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "admin") {
    return <p style={{ color: "var(--status-denied)" }}>Admin only.</p>;
  }
  const orgId = session.user.organizationId;
  if (!orgId) return <p style={{ color: "var(--status-denied)" }}>No organization.</p>;

  const keys = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.organizationId, orgId))
    .orderBy(desc(apiKey.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Use with{" "}
          <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
            POST /api/v1/requests
          </code>{" "}
          and header{" "}
          <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
            Authorization: Bearer &lt;key&gt;
          </code>
          . Body:{" "}
          <code className="text-xs">
            requestTypeSlug, requesterEmail, payload
          </code>
          .
        </p>
      </div>

      <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", color: "var(--ink-2)" }}>
        <p className="font-medium" style={{ color: "var(--ink)" }}>In plain English</p>
        <p className="mt-1">
          API keys are for <strong>automated systems</strong>—scripts, internal
          tools, or partner apps—that create requests on behalf of people
          without someone clicking through the website. They are not your
          personal login; treat them like passwords and revoke them if they
          leak.
        </p>
      </div>

      <CreateApiKeyForm />

      <ul className="space-y-2">
        {keys.length === 0 ? (
          <li className="text-sm" style={{ color: "var(--ink-3)" }}>No keys yet.</li>
        ) : (
          keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)" }}
            >
              <div>
                <span className="font-medium">{k.name}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--ink-3)" }}>
                  …{k.lookupId.slice(0, 6)} · created{" "}
                  {k.createdAt
                    ? new Date(k.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>
                {k.revokedAt && (
                  <span className="ml-2 text-xs" style={{ color: "var(--status-denied)" }}>
                    revoked{" "}
                    {new Date(k.revokedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
              {!k.revokedAt && <RevokeApiKeyButton id={k.id} />}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
