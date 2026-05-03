"use client";

import { useState } from "react";
import { saveSamlConfigAction, generateScimTokenAction } from "@/app/actions/sso";
import { useToast } from "@/components/toast";

export function SsoForm({
  initialDomain,
  initialIssuer,
  initialXml,
  scimTokenExists,
  scimUrl,
}: {
  initialDomain: string;
  initialIssuer: string;
  initialXml: string;
  scimTokenExists: boolean;
  scimUrl: string;
}) {
  const { showToast } = useToast();
  const [domain, setDomain] = useState(initialDomain);
  const [issuer, setIssuer] = useState(initialIssuer);
  const [xml, setXml] = useState(initialXml);
  const [loading, setLoading] = useState(false);

  const [scimLoading, setScimLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  async function handleSaveSaml(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await saveSamlConfigAction(domain, issuer, xml);
      if (res.ok) {
        showToast("SAML Configuration saved successfully", "success");
      }
    } catch (err) {
      showToast("Failed to save SAML configuration", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateScim() {
    if (scimTokenExists && !window.confirm("Generating a new token will invalidate the old one. Continue?")) {
      return;
    }
    setScimLoading(true);
    try {
      const res = await generateScimTokenAction();
      if (res.ok) {
        setGeneratedToken(res.token);
        showToast("SCIM Token generated. Save this token immediately.", "success");
      }
    } catch (err) {
      showToast("Failed to generate SCIM token", "error");
    } finally {
      setScimLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* SAML Configuration */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">SAML Configuration</h2>
          <p className="mt-1 text-xs text-zinc-500">Enable Single Sign-On for your domain.</p>
        </div>
        <form onSubmit={handleSaveSaml} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Domain</label>
            <input
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">IdP Issuer URL</label>
            <input
              required
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="e.g. http://www.okta.com/exk..."
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">IdP Metadata XML</label>
            <textarea
              required
              rows={6}
              value={xml}
              onChange={(e) => setXml(e.target.value)}
              placeholder="Paste your IDP metadata XML here..."
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
            >
              {loading ? "Saving..." : "Save SAML Config"}
            </button>
          </div>
        </form>
      </div>

      {/* SCIM Configuration */}
      <div className="h-fit rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">SCIM 2.0 Provisioning</h2>
          <p className="mt-1 text-xs text-zinc-500">Automatically sync users from Okta or Entra ID.</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Base URL</label>
            <code className="mt-1 block w-full overflow-x-auto whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              {scimUrl}
            </code>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Provisioning Token</label>
            {generatedToken ? (
              <div className="mt-1">
                <code className="block w-full break-all rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                  {generatedToken}
                </code>
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  Copy this token now. It will not be shown again.
                </p>
              </div>
            ) : scimTokenExists ? (
              <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                Token is configured and active.
              </div>
            ) : (
              <div className="mt-1 text-sm text-zinc-500">No token generated yet.</div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleGenerateScim}
              disabled={scimLoading}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
            >
              {scimLoading ? "Generating..." : scimTokenExists ? "Rotate SCIM Token" : "Generate SCIM Token"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
