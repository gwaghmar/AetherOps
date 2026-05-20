"use client";

import { useEffect, useState } from "react";

function formatDuration(ms: number): string {
  if (ms <= 0) return "Overdue";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ApprovalDeadlineTimer({ deadlineAt }: { deadlineAt: string }) {
  const target = new Date(deadlineAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const isUrgent = remaining < 2 * 3600 * 1000;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={{
        background: isUrgent
          ? "color-mix(in srgb, var(--status-denied) 10%, transparent)"
          : "color-mix(in srgb, var(--status-pending) 10%, transparent)",
        color: isUrgent ? "var(--status-denied)" : "var(--status-pending)",
      }}
    >
      {formatDuration(remaining)}
    </span>
  );
}
