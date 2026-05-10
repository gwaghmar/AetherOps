import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { connectorCredential } from "@/db/app-schema";
import { eq } from "drizzle-orm";
import { VaultForm } from "./vault-form";
import { Shield, KeyRound, Clock } from "lucide-react";

export default async function VaultPage() {
  const session = await requireSession();
  
  const credentials = await db.query.connectorCredential.findMany({
    where: eq(connectorCredential.organizationId, session.user.organizationId!),
    orderBy: (creds, { desc }) => [desc(creds.updatedAt)],
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
          <Shield className="h-6 w-6" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credential Vault</h1>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Securely manage encrypted API keys and tokens for your integrations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
            <h2 className="font-medium">Stored Credentials</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {credentials.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm" style={{ color: "var(--ink-3)" }}>
                No credentials stored yet.
              </div>
            ) : (
              credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5" style={{ color: "var(--ink-3)" }} />
                    <div>
                      <div className="font-medium">{cred.connectorId}</div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-3)" }}>
                        <Clock className="h-3 w-3" />
                        Updated {new Date(cred.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                    style={{ background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }}>
                    Encrypted
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <VaultForm />
        </div>
      </div>
    </div>
  );
}
