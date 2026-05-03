"use client";

import { useState } from "react";
import { createCampaignAction } from "@/app/actions/access-reviews";
import { useToast } from "@/components/toast";
import { Plus } from "lucide-react";

export function CreateCampaignButton() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleCreate() {
    if (!window.confirm("Start a new quarterly access review campaign? This will gather all active provisioning requests and assign them for review.")) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await createCampaignAction();
      if (result.ok) {
        showToast(`Campaign started with ${result?.itemsCount} items to review.`, "success");
      } else {
        showToast("Failed to start campaign.", "error");
      }
    } catch (e) {
      showToast("An unexpected error occurred.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      <Plus className="h-4 w-4" />
      {loading ? "Creating..." : "Start Campaign"}
    </button>
  );
}
