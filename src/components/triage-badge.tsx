import type { TriageRisk } from "@/server/ai/triage";

const variantStyle: Record<TriageRisk, { label: string; background: string; color: string }> = {
  low: {
    label: "Low risk",
    background: "color-mix(in srgb, var(--status-approved) 10%, transparent)",
    color: "var(--status-approved)",
  },
  medium: {
    label: "Medium risk",
    background: "color-mix(in srgb, var(--status-pending) 10%, transparent)",
    color: "var(--status-pending)",
  },
  high: {
    label: "High risk",
    background: "color-mix(in srgb, var(--status-pending) 15%, transparent)",
    color: "var(--status-pending)",
  },
  critical: {
    label: "Critical risk",
    background: "color-mix(in srgb, var(--status-denied) 10%, transparent)",
    color: "var(--status-denied)",
  },
};

export function TriageBadge({
  risk,
  reason,
}: {
  risk: string;
  reason?: string | null;
}) {
  const variant = variantStyle[risk as TriageRisk];
  if (!variant) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={reason ?? undefined}
    >
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: variant.background, color: variant.color }}
      >
        ✦ {variant.label}
      </span>
      {reason && (
        <span className="max-w-xs truncate text-xs" style={{ color: "var(--ink-3)" }}>
          {reason}
        </span>
      )}
    </span>
  );
}
