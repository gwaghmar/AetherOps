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
  const { toast } = useToast();
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
        toast("SAML Configuration saved successfully", "success");
      }
    } catch (err) {
      toast("Failed to save SAML configuration", "error");
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
        toast("SCIM Token generated. Save this token immediately.", "success");
      }
    } catch (err) {
      toast("Failed to generate SCIM token", "error");
    } finally {
      setScimLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* SAML Configuration */}
      <div className="rounded-xl border shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="font-medium" style={{ color: "var(--ink)" }}>SAML Configuration</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Enable Single Sign-On for your domain.</p>
        </div>
        <form onSubmit={handleSaveSaml} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Email Domain</label>
            <input
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ borderColor: "var(--line)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>IdP Issuer URL</label>
            <input
              required
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="e.g. http://www.okta.com/exk..."
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ borderColor: "var(--line)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>IdP Metadata XML</label>
            <textarea
              required
              rows={6}
              value={xml}
              onChange={(e) => setXml(e.target.value)}
              placeholder="Paste your IDP metadata XML here..."
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ borderColor: "var(--line)" }}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
            >
              {loading ? "Saving..." : "Save SAML Config"}
            </button>
          </div>
        </form>
      </div>

      {/* SCIM Configuration */}
      <div className="h-fit rounded-xl border shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="font-medium" style={{ color: "var(--ink)" }}>SCIM 2.0 Provisioning</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Automatically sync users from Okta or Entra ID.</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Base URL</label>
            <code className="mt-1 block w-full overflow-x-auto whitespace-nowrap rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--line)", background: "var(--subtle)" }}>
              {scimUrl}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>Provisioning Token</label>
            {generatedToken ? (
              <div className="mt-1">
                <code className="block w-full break-all rounded-md border px-3 py-2 text-sm" style={{ borderColor: "color-mix(in srgb, var(--status-approved) 25%, transparent)", background: "color-mix(in srgb, var(--status-approved) 8%, transparent)", color: "var(--status-approved)" }}>
                  {generatedToken}
                </code>
                <p className="mt-2 text-xs font-medium" style={{ color: "var(--status-denied)" }}>
                  Copy this token now. It will not be shown again.
                </p>
              </div>
            ) : scimTokenExists ? (
              <div className="mt-1 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--line)", background: "var(--subtle)", color: "var(--ink-3)" }}>
                Token is configured and active.
              </div>
            ) : (
              <div className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>No token generated yet.</div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleGenerateScim}
              disabled={scimLoading}
              className="w-full rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}
            >
              {scimLoading ? "Generating..." : scimTokenExists ? "Rotate SCIM Token" : "Generate SCIM Token"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
