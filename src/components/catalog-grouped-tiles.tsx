"use client";

import Link from "next/link";
import type { CatalogTileLike } from "@/lib/catalog-categories";
import { groupCatalogTiles } from "@/lib/catalog-categories";

function CatalogTile({ tile, featured = false }: { tile: CatalogTileLike; featured?: boolean }) {
  const initial = tile.title.slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/requests/new?typeId=${encodeURIComponent(tile.id)}`}
      className="group flex flex-col rounded-[7px] p-[11px] border transition-all"
      style={
        featured
          ? {
              borderColor: "transparent",
              background: `
                linear-gradient(var(--surface), var(--surface)) padding-box,
                linear-gradient(90deg, var(--line) 0%, var(--accent) 50%, var(--line) 100%) border-box
              `,
              backgroundSize: "200% auto",
              animation: "shimmer-border 2.5s linear infinite",
            }
          : {
              background: "var(--surface)",
              borderColor: "var(--line)",
            }
      }
      onMouseEnter={(e) => {
        if (!featured) {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "#D4D4D0";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!featured) {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "var(--line)";
          el.style.boxShadow = "none";
        }
      }}
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-xs font-semibold mb-[6px]"
        style={{
          background: featured ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--subtle)",
          color: featured ? "var(--accent)" : "var(--ink-3)",
        }}
      >
        {initial}
      </span>
      <span
        className="text-[11.5px] font-medium tracking-[-0.02em] mb-[2px]"
        style={{ color: "var(--ink)" }}
      >
        {tile.title}
      </span>
      {tile.description ? (
        <span
          className="text-[10.5px] line-clamp-2 leading-[1.35]"
          style={{ color: "var(--ink-3)" }}
        >
          {tile.description}
        </span>
      ) : (
        <span className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>
          Open form
        </span>
      )}
    </Link>
  );
}

export function CatalogGroupedTiles({ catalog }: { catalog: CatalogTileLike[] }) {
  const groups = groupCatalogTiles(catalog);

  if (groups.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        No catalog items yet. Ask an admin to add request types.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <section
          key={group.id}
          aria-labelledby={`catalog-cat-${group.id}`}
          className="rounded-lg border p-3"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <header className="mb-2.5 pb-2 border-b" style={{ borderColor: "var(--line-dim)" }}>
            <h2
              id={`catalog-cat-${group.id}`}
              className="text-[12.5px] font-semibold tracking-[-0.02em]"
              style={{ color: "var(--ink)" }}
            >
              {group.title}
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {group.subtitle}
            </p>
          </header>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((t, ti) => (
              <li key={t.id}>
                <CatalogTile tile={t} featured={gi === 0 && ti === 0} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
