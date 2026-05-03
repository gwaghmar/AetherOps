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
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="rounded-xl bg-purple-50 p-2 dark:bg-purple-900/20">
          <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credential Vault</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Securely manage encrypted API keys and tokens for your integrations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="font-medium">Stored Credentials</h2>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {credentials.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-zinc-500">
                No credentials stored yet.
              </div>
            ) : (
              credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-zinc-400" />
                    <div>
                      <div className="font-medium">{cred.connectorId}</div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        Updated {new Date(cred.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
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
