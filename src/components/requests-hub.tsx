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
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-all duration-500 ease-out ${
                s.active
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-700 shadow-[0_0_12px_-2px_rgba(6,182,212,0.5)] dark:border-cyan-400/50 dark:bg-cyan-950/40 dark:text-cyan-200"
                  : s.done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 ? (
              <div
                className={`h-px min-w-[12px] flex-1 rounded transition-colors duration-500 ${
                  s.done && steps[i + 1]?.done
                    ? "bg-emerald-400/50"
                    : s.active
                      ? "bg-gradient-to-r from-cyan-500/40 to-zinc-200 dark:to-zinc-700"
                      : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
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
        <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
          <p className="font-medium">Seeing extra admin links?</p>
          <p className="mt-1 text-violet-800/90 dark:text-violet-300/90">
            That’s normal for an admin. To preview a regular user’s home, sign
            out and sign in with a non-admin account—or use a private window
            with a second test user.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Start something from the catalog below. Your recent items appear
          under it—use the search field in the header to filter this list.
        </p>
      </div>

      <section aria-label="Service catalog">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Start a request
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Grouped by category—the same layout as Home.
        </p>
        <div className="mt-4">
          <CatalogGroupedTiles catalog={catalog} />
        </div>
      </section>

      <section aria-label="Your requests">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your requests
          </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Filter with the search box in the header (reference, type, status,
          or approver).
          {listPagination?.cursorActive ? (
            <span className="ml-2">
              <Link
                href="/requests"
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                Back to first page
              </Link>
            </span>
          ) : null}
        </p>
        </div>

        <ul className="mt-3 space-y-2.5">
          {filtered.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
              {requests.length === 0 ? (
                <>
                  No requests yet. Choose a tile above to start one, or{" "}
                  <Link
                    href="/requests/new"
                    className="font-medium text-zinc-900 underline dark:text-zinc-100"
                  >
                    open the full form
                  </Link>
                  .
                  {isAdmin ? (
                    <span className="mt-2 block">
                      Admins: empty catalog? Run{" "}
                      <Link
                        href="/onboarding"
                        className="font-medium text-zinc-900 underline dark:text-zinc-100"
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
                  className="block rounded-xl border border-zinc-200 bg-white p-3.5 transition-all duration-300 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-zinc-500">
                        {r.id.slice(0, 8)}…
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {r.typeTitle}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>
                  <Timeline
                    status={r.status}
                    approverEmail={r.approverEmail}
                  />
                  {r.status === "fulfilled" && r.expiresAt && (
                    <div className="mt-3 flex items-center gap-2 text-[10px]">
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        new Date(r.expiresAt).getTime() - now < 24 * 60 * 60 * 1000
                          ? "bg-amber-500 animate-pulse"
                          : "bg-emerald-500"
                      }`} />
                      <span className="text-zinc-500">
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
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Load older requests
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
