import { db } from "@/db";
import { appCatalog } from "@/db/app-schema";
import { requireSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ExternalLink, ShieldAlert, Cpu } from "lucide-react";

export const metadata = {
  title: "App Catalog",
};

export default async function CatalogPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const apps = await db.select().from(appCatalog).where(eq(appCatalog.organizationId, orgId));

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: "var(--subtle)" }}>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Application Catalog
          </h1>
          <p className="mt-2" style={{ color: "var(--ink-3)" }}>
            Browse and request access to standard enterprise tools and targeted AI products.
          </p>
        </header>

        {apps.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <Cpu className="mx-auto h-12 w-12" style={{ color: "var(--ink-3)" }} />
            <h3 className="mt-4 text-sm font-semibold">No Apps Configured</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
              The platform administrator needs to seed the app catalog via scripts/seed-app-catalog.ts.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border p-6 transition-all"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-hover)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                      style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }}>
                      {app.category}
                    </span>
                    {app.telemetrySupport === "full_cost" && (
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                        style={{ background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }}>
                        Cost Monitored
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">
                    {app.appName}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
                    Vendor: <span className="font-medium" style={{ color: "var(--ink-2)" }}>{app.vendor}</span>
                  </p>

                  {app.knownLimits && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs"
                      style={{ background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }}>
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>{app.knownLimits}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                  {app.setupGuideUrl ? (
                    <a
                      href={app.setupGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                      style={{ color: "var(--accent)" }}
                    >
                      Knowledge Base
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>No Docs</span>
                  )}

                  <Link
                    href={`/requests/new?app=${encodeURIComponent(app.appName)}`}
                    className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
                  >
                    Request Access
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
