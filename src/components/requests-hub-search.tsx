"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function RequestsHubSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const [value, setValue] = useState(qParam);

  useEffect(() => {
    setValue(qParam);
  }, [qParam]);

  const replaceQuery = useCallback(
    (next: string) => {
      const t = next.trim();
      const url = t ? `/requests?q=${encodeURIComponent(t)}` : "/requests";
      router.replace(url, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (pathname !== "/requests") return;
    const handle = setTimeout(() => {
      if (value.trim() !== qParam.trim()) replaceQuery(value);
    }, 200);
    return () => clearTimeout(handle);
  }, [value, qParam, pathname, replaceQuery]);

  if (pathname !== "/requests") return null;

  return (
    <div className="flex min-w-[14rem] max-w-md flex-1 basis-full items-center gap-2 rounded-lg border px-2 py-1.5 sm:basis-auto" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Search your requests</span>
        <input
          type="search"
          aria-label="Search requests"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search requests by ID, type, status, approver…"
          autoComplete="off"
          className="w-full border-0 bg-transparent px-1 text-sm focus:outline-none"
          style={{ "--tw-placeholder-color": "var(--ink-3)" } as React.CSSProperties}
        />
      </label>
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear request search"
          className="rounded-md px-2 py-1 text-xs transition-colors"
          style={{ color: "var(--ink-2)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--subtle)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
