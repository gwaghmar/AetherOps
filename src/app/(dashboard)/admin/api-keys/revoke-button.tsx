"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRevokeApiKey } from "@/app/actions/admin";
import { useToast } from "@/components/toast";

export function RevokeApiKeyButton({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Revoke this API key? Agents using it will fail immediately.")) {
          return;
        }
        setPending(true);
        try {
          await adminRevokeApiKey({ id });
          toast("API key revoked", "success");
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Revoke failed", "error");
          setPending(false);
        }
      }}
      className="text-xs underline disabled:opacity-50"
      style={{ color: "var(--status-denied)" }}
    >
      Revoke
    </button>
  );
}
