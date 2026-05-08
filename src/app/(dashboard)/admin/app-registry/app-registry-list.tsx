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
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Registered Applications</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {showForm ? "Cancel" : "Add Application"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">App Name</label>
              <input required name="appName" placeholder="e.g. OpenAI Enterprise" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor</label>
              <input required name="vendor" placeholder="e.g. OpenAI" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
              <input required name="category" placeholder="e.g. AI/Generative" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor Setup Guide URL</label>
              <input name="setupGuideUrl" placeholder="https://docs.vendor.com/setup" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Connector Type</label>
              <select name="connectorType" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                <option value="manual_ticketing">Manual Ticketing</option>
                <option value="SCIM">SCIM 2.0</option>
                <option value="slack">Slack</option>
                <option value="github">GitHub</option>
                <option value="aws">AWS</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">SSO Support</label>
                <select name="ssoSupport" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Telemetry</label>
                <select name="telemetrySupport" className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                  <option value="none">None</option>
                  <option value="full_cost">Cost/Usage</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Known Limits & Rules</label>
              <textarea name="knownLimits" rows={3} placeholder="Optional. You can use the AI ingest feature later to populate this from the Setup Guide URL." className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            </div>
          </div>
          <div className="col-span-1 flex justify-end lg:col-span-2">
            <button disabled={loading} type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
              {loading ? "Saving..." : "Save to Registry"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map(app => (
          <div key={app.id} className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{app.appName}</h3>
                  <p className="text-xs text-zinc-500">{app.vendor} • {app.category}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {app.connectorType}
                </span>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1"><Key className="h-3 w-3" /> SSO: {app.ssoSupport === "true" ? "Yes" : "No"}</span>
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Telemetry: {app.telemetrySupport}</span>
              </div>

              {app.knownLimits && (
                <div className="mt-4 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <p className="font-medium mb-1">KB / AI Rules:</p>
                  <p className="line-clamp-3 leading-relaxed">{app.knownLimits}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <a href={app.setupGuideUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                <Globe className="h-3.5 w-3.5" />
                Docs
              </a>
              <button
                onClick={() => handleIngest(app.id, app.setupGuideUrl)}
                disabled={ingestingId === app.id}
                className="flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {ingestingId === app.id ? "Ingesting..." : "AI Ingest Docs"}
              </button>
            </div>
          </div>
        ))}
        {apps.length === 0 && !showForm && (
          <div className="col-span-full rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500">No applications registered in the Knowledge Base.</p>
          </div>
        )}
      </div>
    </div>
  );
}
