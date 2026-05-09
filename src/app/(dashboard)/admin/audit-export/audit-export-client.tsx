"use client";

import { useState } from "react";

const MAX_RANGE_DAYS = 90;

function toIsoDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function AuditExportClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDateInput(d);
  });
  const [to, setTo] = useState(() => toIsoDateInput(new Date()));

  const days = daysBetween(from, to);
  const rangeError =
    days < 0
      ? "Start date must be before end date."
      : days > MAX_RANGE_DAYS
        ? `Range is ${days} days — maximum is ${MAX_RANGE_DAYS}. Split into smaller exports.`
        : null;

  const csvHref = `/api/admin/audit-export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const pdfHref = `/api/admin/audit-pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          From (UTC date)
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
      </div>
      <div>
        <label className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          To (UTC date)
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        />
      </div>
      {rangeError ? (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--status-pending) 25%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)", color: "var(--status-pending)" }}>
          {rangeError}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          Exporting {days} day{days === 1 ? "" : "s"} of audit data (max {MAX_RANGE_DAYS} days per export).
          Uses your signed-in session cookie — open links in the same browser.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <a
          href={rangeError ? "#" : csvHref}
          aria-disabled={!!rangeError}
          onClick={rangeError ? (e) => e.preventDefault() : undefined}
          className="inline-flex rounded-lg px-4 py-2 text-sm font-medium"
          style={rangeError
            ? { background: "var(--subtle)", color: "var(--ink-3)", cursor: "not-allowed" }
            : { background: "var(--ink)", color: "var(--ink-on-accent)" }}
        >
          Download CSV
        </a>
        <a
          href={rangeError ? "#" : pdfHref}
          aria-disabled={!!rangeError}
          onClick={rangeError ? (e) => e.preventDefault() : undefined}
          className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
          style={rangeError
            ? { borderColor: "var(--line)", color: "var(--ink-3)", cursor: "not-allowed" }
            : { borderColor: "var(--line)", color: "var(--ink)" }}
        >
          Download PDF evidence
        </a>
      </div>
    </div>
  );
}
