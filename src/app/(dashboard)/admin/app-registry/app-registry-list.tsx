"use client";

import { useState } from "react";
import { createAppAction, ingestVendorDocsAction } from "@/app/actions/app-registry";
import { useToast } from "@/components/toast";
import { Sparkles, Globe, Key, Shield } from "lucide-react";

type App = {
  id: string;
  appName: string;
  vendor: string;
  category: string;
  connectorType: string;
  ssoSupport: string;
  telemetrySupport: string;
  knownLimits: string | null;
  setupGuideUrl: string | null;
};

export function AppRegistryList({ apps }: { apps: App[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);

  async function handleIngest(appId: string, url: string | null) {
    if (!url) {
      toast("No setup guide URL provided for this app.", "error");
      return;
    }
    setIngestingId(appId);
    try {
      const res = await ingestVendorDocsAction(appId, url);
      if (res.ok) {
        toast("Successfully ingested and summarized vendor docs using AI.", "success");
      }
    } catch (err) {
      toast("Failed to ingest docs. Ensure the URL is accessible.", "error");
    } finally {
      setIngestingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createAppAction({
        appName: fd.get("appName") as string,
        vendor: fd.get("vendor") as string,
        category: fd.get("category") as string,
        connectorType: fd.get("connectorType") as string,
        ssoSupport: fd.get("ssoSupport") as string,
        telemetrySupport: fd.get("telemetrySupport") as string,
        knownLimits: fd.get("knownLimits") as string,
        setupGuideUrl: fd.get("setupGuideUrl") as string,
      });
      if (res.ok) {
        toast("App added to registry", "success");
        setShowForm(false);
      }
    } catch (err) {
      toast("Failed to add app", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium" style={{ color: "var(--ink)" }}>Registered Applications</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:opacity-90"
          style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
        >
          {showForm ? "Cancel" : "Add Application"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-6 rounded-xl border p-6 shadow-sm lg:grid-cols-2" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>App Name</label>
              <input required name="appName" placeholder="e.g. OpenAI Enterprise" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Vendor</label>
              <input required name="vendor" placeholder="e.g. OpenAI" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Category</label>
              <input required name="category" placeholder="e.g. AI/Generative" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Vendor Setup Guide URL</label>
              <input name="setupGuideUrl" placeholder="https://docs.vendor.com/setup" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Connector Type</label>
              <select name="connectorType" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                <option value="manual_ticketing">Manual Ticketing</option>
                <option value="SCIM">SCIM 2.0</option>
                <option value="slack">Slack</option>
                <option value="github">GitHub</option>
                <option value="aws">AWS</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>SSO Support</label>
                <select name="ssoSupport" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Telemetry</label>
                <select name="telemetrySupport" className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                  <option value="none">None</option>
                  <option value="full_cost">Cost/Usage</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Known Limits & Rules</label>
              <textarea name="knownLimits" rows={3} placeholder="Optional. You can use the AI ingest feature later to populate this from the Setup Guide URL." className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
            </div>
          </div>
          <div className="col-span-1 flex justify-end lg:col-span-2">
            <button disabled={loading} type="submit" className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}>
              {loading ? "Saving..." : "Save to Registry"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map(app => (
          <div key={app.id} className="flex flex-col justify-between rounded-xl border p-5 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--ink)" }}>{app.appName}</h3>
                  <p className="text-xs" style={{ color: "var(--ink-3)" }}>{app.vendor} • {app.category}</p>
                </div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--subtle)", color: "var(--ink-2)" }}>
                  {app.connectorType}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs" style={{ color: "var(--ink-2)" }}>
                <span className="flex items-center gap-1"><Key className="h-3 w-3" /> SSO: {app.ssoSupport === "true" ? "Yes" : "No"}</span>
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Telemetry: {app.telemetrySupport}</span>
              </div>

              {app.knownLimits && (
                <div className="mt-4 rounded-md p-3 text-xs" style={{ background: "var(--subtle)", color: "var(--ink-2)" }}>
                  <p className="font-medium mb-1">KB / AI Rules:</p>
                  <p className="line-clamp-3 leading-relaxed">{app.knownLimits}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <a href={app.setupGuideUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                <Globe className="h-3.5 w-3.5" />
                Docs
              </a>
              <button
                onClick={() => handleIngest(app.id, app.setupGuideUrl)}
                disabled={ingestingId === app.id}
                className="flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {ingestingId === app.id ? "Ingesting..." : "AI Ingest Docs"}
              </button>
            </div>
          </div>
        ))}
        {apps.length === 0 && !showForm && (
          <div className="col-span-full rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--line)" }}>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>No applications registered in the Knowledge Base.</p>
          </div>
        )}
      </div>
    </div>
  );
}
