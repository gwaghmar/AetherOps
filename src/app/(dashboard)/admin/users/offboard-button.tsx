"use client";

import { useState } from "react";
import { offboardUserAction } from "@/app/actions/roles";
import { useToast } from "@/components/toast";
import { UserMinus } from "lucide-react";

export function OffboardButton({ userId, userName }: { userId: string, userName: string | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleOffboard() {
    const confirmed = confirm(`Are you sure you want to offboard ${userName || userId}? This will trigger revocations for all their active access requests.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await offboardUserAction(userId);
      if (res.ok) {
        toast(`Successfully offboarded ${userName || "user"}.`, "success");
      }
    } catch (err) {
      toast("Failed to offboard user.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleOffboard}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
    >
      <UserMinus className="h-3.5 w-3.5" />
      {loading ? "Offboarding..." : "Offboard"}
    </button>
  );
}
