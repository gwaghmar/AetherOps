import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { ssoProvider, scimProvider } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { SsoForm } from "./sso-form";
import { ShieldCheck } from "lucide-react";
import { getPublicAppUrl } from "@/lib/env";

export default async function SsoPage() {
  const session = await requireSession();
  const organizationId = session.user.organizationId!;

  const [saml] = await db.select().from(ssoProvider).where(eq(ssoProvider.organizationId, organizationId)).limit(1);
  const [scim] = await db.select().from(scimProvider).where(eq(scimProvider.organizationId, organizationId)).limit(1);

  const baseUrl = getPublicAppUrl();
  const scimUrl = `${baseUrl.replace(/\/$/, "")}/api/scim/v2`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-900/20">
          <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enterprise Auth</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Configure SAML SSO and SCIM 2.0 provisioning for Okta, Entra ID, or Google Workspace.
          </p>
        </div>
      </div>

      <SsoForm
        initialDomain={saml?.domain ?? ""}
        initialIssuer={saml?.issuer ?? ""}
        initialXml={saml?.samlConfig ?? ""}
        scimTokenExists={!!scim?.scimToken}
        scimUrl={scimUrl}
      />
    </div>
  );
}
