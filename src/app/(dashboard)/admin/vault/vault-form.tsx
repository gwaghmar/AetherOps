"use client";

import { useState } from "react";
import { storeVaultCredentialAction } from "@/app/actions/vault";
import { useToast } from "@/components/toast";
import { Lock } from "lucide-react";

export function VaultForm() {
  const { showToast } = useToast();
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
        showToast("Credential securely stored in vault", "success");
        (e.target as HTMLFormElement).reset();
      } else {
        showToast(result.error || "Failed to store credential", "error");
      }
    } catch (err) {
      showToast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4 text-zinc-500" />
          Add / Update Credential
        </h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        <div>
          <label htmlFor="connectorId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Connector ID
          </label>
          <input
            id="connectorId"
            name="connectorId"
            type="text"
            required
            placeholder="e.g., github, linear, aws"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700"
          />
        </div>
        <div>
          <label htmlFor="payload" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Secure Payload (JSON)
          </label>
          <textarea
            id="payload"
            name="payload"
            required
            rows={5}
            placeholder='{"apiKey": "...", "secret": "..."}'
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 font-mono"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Must be a valid JSON object. This will be AES-256-GCM encrypted before saving to the database.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
          >
            {loading ? "Encrypting..." : "Store Securely"}
          </button>
        </div>
      </form>
    </div>
  );
}
