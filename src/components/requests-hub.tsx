"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CatalogGroupedTiles } from "@/components/catalog-grouped-tiles";
import { requestStatusLabel } from "@/lib/status-labels";

export type CatalogTile = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

export type MyRequestRow = {
  id: string;
  status: string;
  typeTitle: string;
  approverEmail: string | null;
  expiresAt: Date | null;
};

function Timeline({
  status,
  approverEmail,
}: {
  status: string;
  approverEmail: string | null;
}) {
  const inFlight =
    status === "pending_approval" || status === "needs_info";
  const done = status === "fulfilled";
  const failed = status === "failed";

  const steps = [
    { key: "submitted", label: "Submitted", done: true, active: false },
    {
      key: "review",
      label: inFlight
        ? approverEmail
          ? `With ${approverEmail}`
          : "In review"
        : "Review",
      done: !inFlight && (done || failed),
      active: inFlight,
    },
    {
      key: "end",
      label: failed ? "Stopped" : "Finished",
      done: done || failed,
      active: false,
    },
  ];

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-all duration-500 ease-out"
              style={s.active
                ? { borderColor: "color-mix(in srgb, var(--accent) 60%, transparent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }
                : s.done
                  ? { borderColor: "color-mix(in srgb, var(--status-approved) 40%, transparent)", background: "color-mix(in srgb, var(--status-approved) 10%, transparent)", color: "var(--status-approved)" }
                  : { borderColor: "var(--line)", background: "var(--subtle)", color: "var(--ink-3)" }
              }
            >
              {i + 1}
            </div>
            {i < steps.length - 1 ? (
              <div
                className="h-px min-w-[12px] flex-1 rounded transition-colors duration-500"
                style={{
                  background: s.done && steps[i + 1]?.done
                    ? "color-mix(in srgb, var(--status-approved) 50%, transparent)"
                    : s.active
                      ? "linear-gradient(to right, color-mix(in srgb, var(--accent) 40%, transparent), var(--subtle))"
                      : "var(--subtle)"
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
        {steps.map((s) => (
          <span key={s.key} className="truncate text-center">
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RequestsHub({
  catalog,
  requests,
  isAdmin,
  now,
  listPagination,
}: {
  catalog: CatalogTile[];
  requests: MyRequestRow[];
  isAdmin: boolean;
  now: number;
  listPagination?: {
    cursorActive: boolean;
    nextBeforeIso: string | null;
  };
}) {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.typeTitle.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.approverEmail?.toLowerCase().includes(q) ?? false),
    );
  }, [requests, q]);

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", color: "var(--ink-2)" }}>
          <p className="font-medium" style={{ color: "var(--ink)" }}>Seeing extra admin links?</p>
          <p className="mt-1">
            That’s normal for an admin. To preview a regular user’s home, sign
            out and sign in with a non-admin account—or use a private window
            with a second test user.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Start something from the catalog below. Your recent items appear
          under it—use the search field in the header to filter this list.
        </p>
      </div>

      <section aria-label="Service catalog">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Start a request
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Grouped by category—the same layout as Home.
        </p>
        <div className="mt-4">
          <CatalogGroupedTiles catalog={catalog} />
        </div>
      </section>

      <section aria-label="Your requests">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
            Your requests
          </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Filter with the search box in the header (reference, type, status,
          or approver).
          {listPagination?.cursorActive ? (
            <span className="ml-2">
              <Link
                href="/requests"
                className="font-medium underline"
                style={{ color: "var(--ink)" }}
              >
                Back to first page
              </Link>
            </span>
          ) : null}
        </p>
        </div>

        <ul className="mt-3 space-y-2.5">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
              {requests.length === 0 ? (
                <>
                  No requests yet. Choose a tile above to start one, or{" "}
                  <Link
                    href="/requests/new"
                    className="font-medium underline" style={{ color: "var(--ink)" }}
                  >
                    open the full form
                  </Link>
                  .
                  {isAdmin ? (
                    <span className="mt-2 block">
                      Admins: empty catalog? Run{" "}
                      <Link
                        href="/onboarding"
                        className="font-medium underline" style={{ color: "var(--ink)" }}
                      >
                        onboarding
                      </Link>{" "}
                      or add types under Admin → Catalog.
                    </span>
                  ) : null}
                </>
              ) : (
                "No matches—try another search in the header."
              )}
            </li>
          ) : (
            filtered.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="block rounded-xl border p-3.5 transition-all duration-300"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "var(--shadow-hover)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"; }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
                        {r.id.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {r.typeTitle}
                      </p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--subtle)", color: "var(--ink-2)" }}>
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>
                  <Timeline
                    status={r.status}
                    approverEmail={r.approverEmail}
                  />
                  {r.status === "fulfilled" && r.expiresAt && (
                    <div className="mt-3 flex items-center gap-2 text-[10px]">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${new Date(r.expiresAt).getTime() - now < 24 * 60 * 60 * 1000 ? "animate-pulse" : ""}`}
                        style={{ background: new Date(r.expiresAt).getTime() - now < 24 * 60 * 60 * 1000 ? "var(--status-pending)" : "var(--status-approved)" }}
                      />
                      <span style={{ color: "var(--ink-3)" }}>
                        Expires: {new Date(r.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))
          )}
        </ul>
        {listPagination?.nextBeforeIso ? (
          <div className="mt-3 flex justify-center">
            <Link
              href={`/requests?before=${encodeURIComponent(listPagination.nextBeforeIso)}`}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--subtle)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              Load older requests
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
