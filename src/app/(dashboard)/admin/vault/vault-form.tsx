"use client";

import { useState } from "react";
import { storeVaultCredentialAction } from "@/app/actions/vault";
import { useToast } from "@/components/toast";
import { Lock } from "lucide-react";

export function VaultForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const connectorId = formData.get("connectorId") as string;
    const payload = formData.get("payload") as string;

    setLoading(true);
    try {
      const result = await storeVaultCredentialAction(connectorId, payload);
      if (result.ok) {
        toast("Credential securely stored in vault", "success");
        (e.target as HTMLFormElement).reset();
      } else {
        toast(result.error || "Failed to store credential", "error");
      }
    } catch (err) {
      toast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
        <h2 className="flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
          Add / Update Credential
        </h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        <div>
          <label htmlFor="connectorId" className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Connector ID
          </label>
          <input
            id="connectorId"
            name="connectorId"
            type="text"
            required
            placeholder="e.g., github, linear, aws"
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          />
        </div>
        <div>
          <label htmlFor="payload" className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Secure Payload (JSON)
          </label>
          <textarea
            id="payload"
            name="payload"
            required
            rows={5}
            placeholder='{"apiKey": "...", "secret": "..."}'
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm bg-transparent font-mono"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          />
          <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
            Must be a valid JSON object. This will be AES-256-GCM encrypted before saving to the database.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
          >
            {loading ? "Encrypting..." : "Store Securely"}
          </button>
        </div>
      </form>
    </div>
  );
}
