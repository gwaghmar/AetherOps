"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteRequestType } from "@/app/actions/admin";
import { useToast } from "@/components/toast";

export function DeleteTypeButton({
  id,
  slug,
  requestCount,
  archived,
}: {
  id: string;
  slug: string;
  requestCount: number;
  archived: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const label = archived
    ? requestCount > 0
      ? "Archived"
      : "Delete permanently"
    : requestCount > 0
      ? "Archive"
      : "Delete";

  if (archived && requestCount > 0) {
    return (
      <span className="text-xs" style={{ color: "var(--ink-3)" }}>
        Archived · {requestCount} request{requestCount === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const msg = archived
          ? `Permanently delete request type “${slug}”? This frees the slug.`
          : requestCount > 0
            ? `Archive “${slug}”? It will disappear from the catalog and API, but existing requests stay linked.`
            : `Delete request type “${slug}”? No requests use it yet.`;
        if (!confirm(msg)) return;
        setPending(true);
        try {
          await adminDeleteRequestType({ id });
          toast(`Type "${slug}" ${archived ? "permanently deleted" : requestCount > 0 ? "archived" : "deleted"}`, "success");
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Action failed", "error");
          setPending(false);
        }
      }}
      className="text-xs underline disabled:opacity-50"
      style={{ color: requestCount > 0 && !archived ? "var(--status-pending)" : "var(--status-denied)" }}
    >
      {pending ? "…" : label}
    </button>
  );
}
