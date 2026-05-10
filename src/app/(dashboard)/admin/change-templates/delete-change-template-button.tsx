"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteChangeTemplate } from "@/app/actions/admin";
import { useToast } from "@/components/toast";

export function DeleteChangeTemplateButton({
  id,
  slug,
}: {
  id: string;
  slug: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (
          !confirm(
            `Delete change template "${slug}"? Only allowed if no tickets use it.`,
          )
        ) {
          return;
        }
        setPending(true);
        try {
          await adminDeleteChangeTemplate({ id });
          toast(`Template "${slug}" deleted`, "success");
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : "Delete failed", "error");
          setPending(false);
        }
      }}
      className="text-xs underline disabled:opacity-50"
      style={{ color: "var(--status-denied)" }}
    >
      Delete
    </button>
  );
}