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
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
      style={{
        borderColor: "color-mix(in srgb, var(--status-denied) 25%, transparent)",
        background: "color-mix(in srgb, var(--status-denied) 8%, transparent)",
        color: "var(--status-denied)",
      }}
    >
      <UserMinus className="h-3.5 w-3.5" />
      {loading ? "Offboarding..." : "Offboard"}
    </button>
  );
}
