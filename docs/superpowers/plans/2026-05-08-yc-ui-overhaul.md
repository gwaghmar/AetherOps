# YC UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the entire Aether Ops UI to the YC Modern aesthetic — Geist font, sidebar layout, YC orange `#FF6600`, Linear-inspired data density, CSS-variable dark mode, dot-grid home background, and a custom A-mark logo.

**Architecture:** Phase 1 establishes the design system foundation (tokens, font, logo, shell layout) that every subsequent page depends on. Phase 2 sweeps all pages and shared components to adopt the new tokens. Each task commits independently so the build stays green throughout.

**Tech Stack:** Next.js 16 App Router · Tailwind CSS 4 · `next/font/google` (Geist) · CSS custom properties for theming · existing Magic UI components

**Spec:** `docs/superpowers/specs/2026-05-08-yc-ui-overhaul-design.md`

---

## File Map

### Phase 1 — Shell (do in order, each is a prerequisite for the next)
| File | Action | Responsibility |
|---|---|---|
| `src/app/globals.css` | Modify | Full design token system, dark mode vars, transitions, shimmer keyframe |
| `src/app/layout.tsx` | Modify | Swap Inter→Geist, Geist_Mono; update CSS var references |
| `src/components/logo.tsx` | **Create** | Logo mark + wordmark component, sizes sm/md/lg/xl |
| `src/app/(dashboard)/layout.tsx` | Modify | Sidebar + top-nav shell replacing horizontal-nav-only layout |
| `src/components/dashboard-nav.tsx` | Modify | Rewrite as sidebar nav with icons, section labels, badges, mobile tab bar |

### Phase 2 — Pages (can be done in any order after Phase 1)
| File | Action |
|---|---|
| `src/app/(dashboard)/home/page.tsx` | Modify — dot bg, stat cards, remove BentoGrid |
| `src/components/catalog-grouped-tiles.tsx` | Modify — new tile + shimmer featured tile |
| `src/components/requests-hub.tsx` (if exists) or inline | Modify — table rows, status dots, badges |
| `src/app/(dashboard)/requests/page.tsx` | Modify — token classes |
| `src/app/(dashboard)/requests/[id]/page.tsx` | Modify — token classes |
| `src/app/(dashboard)/approvals/page.tsx` | Modify — token classes |
| `src/app/(dashboard)/changes/page.tsx` | Modify — token classes |
| `src/app/(dashboard)/changes/[id]/page.tsx` + panel | Modify |
| `src/app/(dashboard)/changes/new/page.tsx` + form | Modify |
| `src/app/(dashboard)/catalog/page.tsx` | Modify |
| `src/app/(dashboard)/profile/page.tsx` + form | Modify |
| `src/app/(dashboard)/analytics/page.tsx` | Modify |
| `src/app/(dashboard)/admin/layout.tsx` | Modify |
| All `src/app/(dashboard)/admin/*/page.tsx` (14 pages) | Modify — token sweep |
| `src/app/sign-in/page.tsx` | Modify — tokens, new Logo, button/input styles |
| `src/app/sign-up/page.tsx` + form | Modify |

---

## PHASE 1 — SHELL

---

### Task 1: Design tokens — rewrite `globals.css`

**Files:**
- Modify: `src/app/globals.css`

This is the single source of truth for every color, surface, and border in the app. All Phase 2 work references these tokens. Do this first.

- [ ] **Step 1: Replace globals.css entirely**

```css
/* src/app/globals.css */
@import "tailwindcss";

/* ─── Light mode tokens ─────────────────────────── */
:root {
  --canvas:          #F6F6EF; /* YC cream — outermost page bg */
  --surface:         #FFFFFF; /* cards, panels, nav */
  --subtle:          #FAFAFA; /* main content area */
  --line:            #E8E8E6; /* hairline borders */
  --line-dim:        #F0F0EE; /* table row dividers */

  --ink:             #0F0F0F; /* primary text */
  --ink-2:           #6B6B6B; /* secondary text */
  --ink-3:           #AAAAAA; /* muted / placeholder */

  --accent:          #FF6600; /* YC orange — single brand accent */
  --accent-dim:      rgba(255,102,0,0.12);
  --accent-hover:    #E85C00;

  --status-pending:  #FF6600;
  --status-approved: #3D9970;
  --status-denied:   #E55353;

  /* legacy aliases kept so old code doesn't hard-crash before sweep */
  --background:      var(--canvas);
  --foreground:      var(--ink);
  --yc-orange:       var(--accent);
  --yc-orange-dim:   var(--accent-dim);
}

/* ─── Dark mode tokens ──────────────────────────── */
@media (prefers-color-scheme: dark) {
  :root {
    --canvas:          #0A0A0A;
    --surface:         #111113;
    --subtle:          #161618;
    --line:            #232326;
    --line-dim:        #1C1C1F;

    --ink:             #F5F5F5;
    --ink-2:           #8B8B8F;
    --ink-3:           #4A4A4F;

    --accent:          #FF6600;
    --accent-dim:      rgba(255,102,0,0.15);
    --accent-hover:    #FF7A20;
  }
}

/* Manual dark toggle support */
[data-theme="dark"] {
  --canvas:          #0A0A0A;
  --surface:         #111113;
  --subtle:          #161618;
  --line:            #232326;
  --line-dim:        #1C1C1F;
  --ink:             #F5F5F5;
  --ink-2:           #8B8B8F;
  --ink-3:           #4A4A4F;
  --accent:          #FF6600;
  --accent-dim:      rgba(255,102,0,0.15);
  --accent-hover:    #FF7A20;
}

/* ─── Tailwind 4 token registration ────────────── */
@theme inline {
  --color-canvas:          var(--canvas);
  --color-surface:         var(--surface);
  --color-subtle:          var(--subtle);
  --color-line:            var(--line);
  --color-line-dim:        var(--line-dim);
  --color-ink:             var(--ink);
  --color-ink-2:           var(--ink-2);
  --color-ink-3:           var(--ink-3);
  --color-accent:          var(--accent);
  --color-status-pending:  var(--status-pending);
  --color-status-approved: var(--status-approved);
  --color-status-denied:   var(--status-denied);

  /* legacy — keeps existing bg-background, text-foreground working */
  --color-background:      var(--canvas);
  --color-foreground:      var(--ink);
  --color-yc-orange:       var(--accent);

  --font-sans: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
}

/* ─── Base styles ───────────────────────────────── */
body {
  background: var(--canvas);
  color: var(--ink);
}

/* ─── Interaction transitions ───────────────────── */
input, textarea, select, button, a {
  transition-property: color, background-color, border-color, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  transition-duration: 120ms;
}

/* ─── Focus ring ────────────────────────────────── */
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: none !important;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent-dim) !important;
}

input:disabled, textarea:disabled, select:disabled, button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ─── Magic UI: shimmer border animation ─────────── */
@keyframes shimmer-border {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

/* ─── Dot-grid background (home page) ────────────── */
.dot-grid {
  background-color: var(--canvas);
  background-image: radial-gradient(circle, color-mix(in srgb, var(--ink) 18%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: build succeeds. The legacy aliases keep existing `bg-background` / `text-foreground` classes intact.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): design token system — CSS vars, Tailwind 4 registration, dark mode"
```

---

### Task 2: Swap font to Geist

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace the file with:

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aether Ops | Autonomous AI Operations Platform",
  description:
    "The category-defining operations layer for AI-native companies. Automate intake, safety checks, and fulfillment with a rigorous audit trail.",
  keywords: ["AISM", "AI Operations", "Autonomous Operations", "AI Governance", "Agentic Workflows"],
  authors: [{ name: "Aether Ops Team" }],
  openGraph: {
    title: "Aether Ops | Autonomous AI Operations Platform",
    description: "The category-defining operations layer for AI-native companies.",
    url: "https://aetherops.ai",
    siteName: "Aether Ops",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. Geist loads from Google Fonts via `next/font/google`.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): swap Inter → Geist font, Geist Mono for code"
```

---

### Task 3: Logo component

**Files:**
- Create: `src/components/logo.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/logo.tsx
import Link from "next/link";

type LogoSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, { box: number; radius: number; svgSize: number }> = {
  sm: { box: 24, radius: 6,  svgSize: 13 },
  md: { box: 40, radius: 9,  svgSize: 22 },
  lg: { box: 56, radius: 12, svgSize: 30 },
  xl: { box: 80, radius: 16, svgSize: 44 },
};

interface LogoProps {
  size?: LogoSize;
  wordmark?: boolean;
  href?: string;
  className?: string;
}

function LogoMark({ size = "md" }: { size: LogoSize }) {
  const { box, radius, svgSize } = sizeMap[size];
  return (
    <span
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: "var(--accent)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* Geometric A — no crossbar, clean apex */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M22 8L6 36h7.5L22 18l8.5 18H38L22 8z"
          fill="white"
          fillOpacity={0.95}
        />
      </svg>
    </span>
  );
}

export function Logo({ size = "md", wordmark = true, href = "/home", className }: LogoProps) {
  const textSize =
    size === "sm" ? "text-[13px]" :
    size === "lg" ? "text-[18px]" :
    size === "xl" ? "text-[24px]" :
    "text-[15px]";

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      {wordmark && (
        <span
          className={`font-semibold tracking-tight ${textSize}`}
          style={{ letterSpacing: "-0.03em", color: "var(--ink)" }}
        >
          Aether{" "}
          <span style={{ color: "var(--accent)" }}>Ops</span>
        </span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  ) : (
    inner
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. No consumers yet — the component just needs to compile.

- [ ] **Step 3: Commit**

```bash
git add src/components/logo.tsx
git commit -m "feat(ui): Logo component — A mark + Aether Ops wordmark, sm/md/lg/xl sizes"
```

---

### Task 4: Dashboard shell — sidebar + top nav layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

This replaces the horizontal-only nav with the sidebar + top-bar structure. The `DashboardNav` component will be rebuilt in Task 5; for now we wire in the new structure.

- [ ] **Step 1: Rewrite the dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { RequestsHubSearch } from "@/components/requests-hub-search";
import { ToastProvider } from "@/components/toast";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const role = session.user.role;

  return (
    <ToastProvider>
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--canvas)", color: "var(--ink)" }}
      >
        {/* ── Top nav ── */}
        <header
          className="sticky top-0 z-10 flex items-center gap-4 px-4 border-b"
          style={{
            height: 44,
            background: "color-mix(in srgb, var(--surface) 92%, transparent)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--line)",
          }}
        >
          <Logo size="sm" wordmark href="/home" />

          {/* ⌘K search pill */}
          <Suspense fallback={null}>
            <RequestsHubSearch />
          </Suspense>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 text-sm" style={{ color: "var(--ink-3)" }}>
            <span
              className="text-xs px-2 py-0.5 rounded font-mono border"
              style={{ borderColor: "var(--line)", background: "var(--subtle)", color: "var(--ink-3)" }}
            >
              ⌘K
            </span>
            <span
              className="text-xs truncate max-w-[10rem]"
              style={{ color: "var(--ink-2)" }}
            >
              {session.user.email}
            </span>
            <span
              className="rounded-full text-[10px] px-2 py-0.5 font-medium border"
              style={{
                borderColor: "var(--line)",
                color: "var(--ink-2)",
                background: "var(--subtle)",
              }}
            >
              {role}
            </span>
            <SignOutButton />
          </div>
        </header>

        {/* ── Body: sidebar + main ── */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar — hidden on mobile, shown md+ */}
          <aside
            className="hidden md:flex flex-col flex-shrink-0 border-r overflow-y-auto"
            style={{
              width: 196,
              background: "var(--surface)",
              borderColor: "var(--line)",
            }}
          >
            <DashboardNav role={role} />
          </aside>

          {/* Main content */}
          <main
            className="flex-1 overflow-y-auto p-6 md:p-7"
            style={{ background: "var(--subtle)" }}
          >
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar — rendered by DashboardNav on small screens */}
        <div className="md:hidden">
          <DashboardNav role={role} mobile />
        </div>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. The `DashboardNav` component still exists from before — it will just look mismatched until Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(ui): dashboard shell — sidebar + top-nav layout structure"
```

---

### Task 5: Sidebar navigation component

**Files:**
- Modify: `src/components/dashboard-nav.tsx`

Completely rewrites the nav from a horizontal strip into the sidebar + mobile tab bar.

- [ ] **Step 1: Rewrite dashboard-nav.tsx**

```tsx
// src/components/dashboard-nav.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Role = "requester" | "approver" | "admin";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  actionBadge?: boolean; // orange badge
}

// 14×14 SVG icons — inline, no extra dependency
const Icon = {
  Home: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 6l6-5 6 5v7H9V9H5v4H1V6z" />
    </svg>
  ),
  Requests: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h10M2 7h7M2 10h4" />
    </svg>
  ),
  Clock: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" /><path d="M7 4v3l2 2" />
    </svg>
  ),
  Changes: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 2L2 5v4l5 3 5-3V5L7 2z" />
    </svg>
  ),
  Approvals: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7l3 3 7-6" />
    </svg>
  ),
  Catalog: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="5" height="5" rx="1" /><rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" /><rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  ),
  Admin: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3 3l1.4 1.4M9.6 9.6L11 11M3 11l1.4-1.4M9.6 4.4L11 3" />
    </svg>
  ),
  Analytics: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12V8M5 12V5M8 12V7M11 12V3" />
    </svg>
  ),
};

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  actionBadge?: boolean;
}

function SidebarItem({ href, label, icon, badge, actionBadge }: SidebarItemProps) {
  const pathname = usePathname();
  const active = matchesPath(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-2 px-2 py-[5px] rounded-[5px] text-[12.5px] transition-colors"
      style={{
        fontWeight: active ? 500 : 450,
        color: active ? "var(--ink)" : "var(--ink-2)",
        background: active ? "var(--subtle)" : "transparent",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--subtle)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          color: active ? "var(--accent)" : "var(--ink-3)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span
          className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-[3px]"
          style={{
            background: actionBadge ? "rgba(255,102,0,0.1)" : "var(--subtle)",
            color: actionBadge ? "var(--accent)" : "var(--ink-3)",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{ color: "var(--ink-3)" }}
    >
      {children}
    </div>
  );
}

interface AdminDropdownProps {
  role: Role;
}

function AdminSection({ role }: AdminDropdownProps) {
  const pathname = usePathname();
  const adminItems = [
    { href: "/admin/types",           label: "Catalog",          icon: Icon.Catalog },
    { href: "/admin/app-registry",    label: "App registry",     icon: Icon.Admin },
    { href: "/admin/routing",         label: "Routing",          icon: Icon.Admin },
    { href: "/admin/roles",           label: "Role bundles",     icon: Icon.Admin },
    { href: "/admin/users",           label: "Users",            icon: Icon.Admin },
    { href: "/admin/invites",         label: "Invites",          icon: Icon.Admin },
    { href: "/admin/access-reviews",  label: "Access reviews",   icon: Icon.Clock },
    { href: "/admin/ai",              label: "AI",               icon: Icon.Admin },
    { href: "/admin/api-keys",        label: "API keys",         icon: Icon.Admin },
    { href: "/admin/vault",           label: "Credential vault", icon: Icon.Admin },
    { href: "/admin/billing",         label: "Billing",          icon: Icon.Admin },
    { href: "/admin/integrations",    label: "Integrations",     icon: Icon.Admin },
    { href: "/admin/sso",             label: "Enterprise SSO",   icon: Icon.Admin },
    { href: "/admin/audit-log",       label: "Audit log",        icon: Icon.Requests },
    { href: "/admin/audit-export",    label: "Audit export",     icon: Icon.Requests },
    { href: "/admin/setup-status",    label: "Setup status",     icon: Icon.Admin },
    { href: "/admin/change-templates",label: "Change templates", icon: Icon.Changes },
  ];

  if (role !== "admin") return null;

  return (
    <>
      <SectionLabel>Admin</SectionLabel>
      {adminItems.map((item) => (
        <SidebarItem key={item.href} {...item} />
      ))}
    </>
  );
}

// ── Mobile bottom tab bar (5 key items, icons only) ──────────────────────────
function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/home",        icon: Icon.Home,      label: "Home" },
    { href: "/requests/new",icon: Icon.Requests,  label: "New" },
    { href: "/changes",     icon: Icon.Changes,   label: "Changes" },
    ...(role === "approver" || role === "admin"
      ? [{ href: "/approvals", icon: Icon.Approvals, label: "Approvals" }]
      : []),
    { href: "/catalog",     icon: Icon.Catalog,   label: "Catalog" },
  ].slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex border-t z-20"
      style={{
        background: "color-mix(in srgb, var(--surface) 95%, transparent)",
        backdropFilter: "blur(8px)",
        borderColor: "var(--line)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Mobile navigation"
    >
      {tabs.map((tab) => {
        const active = matchesPath(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-1"
            aria-current={active ? "page" : undefined}
            style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
          >
            {tab.icon}
            <span className="text-[9px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function DashboardNav({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  if (mobile) {
    return <MobileTabBar role={role} />;
  }

  return (
    <nav
      className="flex flex-col gap-0.5 p-2 flex-1"
      aria-label="Primary"
    >
      <SidebarItem href="/home"         label="Home"           icon={Icon.Home} />
      <SidebarItem href="/requests"     label="My requests"    icon={Icon.Requests} />
      <SidebarItem href="/requests/new" label="New request"    icon={Icon.Clock} />
      <SidebarItem href="/changes"      label: "Changes"       icon={Icon.Changes} />

      {(role === "approver" || role === "admin") && (
        <>
          <SectionLabel>Review</SectionLabel>
          <SidebarItem href="/approvals" label="Approvals" icon={Icon.Approvals} />
        </>
      )}

      <SectionLabel>Explore</SectionLabel>
      <SidebarItem href="/catalog"   label="Catalog"    icon={Icon.Catalog} />
      <SidebarItem href="/analytics" label="Analytics"  icon={Icon.Analytics} />

      <AdminSection role={role} />
    </nav>
  );
}
```

- [ ] **Step 2: Fix the typo in the JSX** (the `label:` in the JSX above should be `label=`)

Edit line with `label:` to be `label=`:
```tsx
      <SidebarItem href="/changes"      label="Changes"        icon={Icon.Changes} />
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. The dashboard now has the sidebar.

- [ ] **Step 4: Dev sanity check**

```bash
npm run dev
```

Open `http://localhost:3000`. Sign in. Verify:
- Sidebar appears on desktop (≥768px)
- Logo shows in top nav
- Active nav item highlights with orange icon
- Sidebar items are clickable and navigate correctly
- On mobile width the sidebar is hidden and bottom tab bar appears

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard-nav.tsx
git commit -m "feat(ui): sidebar nav — icons, section labels, badges, mobile tab bar"
```

---

## PHASE 2 — PAGES

> All tasks in Phase 2 can be done in any order. Each replaces hardcoded `zinc-*` / `neutral-*` / `dark:*` classes with CSS variable references. The pattern is always the same: replace Tailwind color utilities with `style={{ color: "var(--ink)" }}` or `className="bg-[var(--surface)]"` (or the registered Tailwind token class e.g. `bg-surface`).

---

### Task 6: Home page — dot grid, stat cards, remove BentoGrid

**Files:**
- Modify: `src/app/(dashboard)/home/page.tsx`

- [ ] **Step 1: Rewrite home/page.tsx**

```tsx
// src/app/(dashboard)/home/page.tsx
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ensureOrganizationOnboardingRow } from "@/app/actions/ai-org";
import { HomeCopilot } from "@/components/home-copilot";
import { CatalogGroupedTiles } from "@/components/catalog-grouped-tiles";
import { db } from "@/db";
import { organizationOnboarding } from "@/db/schema";
import { fetchOrgCatalogTiles } from "@/server/org-catalog";
import { getRecentUserTickets } from "@/server/recent-tickets";
import { requireSession } from "@/lib/session";
import { Activity, ShieldCheck, ShieldAlert } from "lucide-react";
import { SparklesText } from "@/components/magicui/sparkles-text";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  change,
  sparkle = false,
}: {
  label: string;
  value: string;
  change?: string;
  sparkle?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg p-[13px_15px] border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {/* Magic UI: subtle orange gradient wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(255,102,0,0.03) 0%, transparent 60%)",
        }}
      />
      <p
        className="text-[10.5px] font-medium uppercase tracking-[0.01em] mb-[5px]"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </p>
      {sparkle ? (
        <SparklesText
          text={value}
          className="text-[25px] font-semibold tracking-[-0.04em] leading-none tabular-nums"
          style={{ color: "var(--ink)" }}
        />
      ) : (
        <p
          className="text-[25px] font-semibold tracking-[-0.04em] leading-none tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {value}
        </p>
      )}
      {change && (
        <p className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>{change}</span>
        </p>
      )}
    </div>
  );
}

export default async function HomePage() {
  const session = await requireSession();
  const orgId = session.user.organizationId;
  const role = session.user.role;
  const isAdmin = role === "admin";

  const catalog = orgId ? await fetchOrgCatalogTiles(orgId) : [];

  let onboardingIncomplete = false;
  let recentForCopilot: { kind: "request" | "change"; id: string; title: string; status: string }[] = [];

  if (orgId) {
    await ensureOrganizationOnboardingRow(orgId);
    const [onb] = await db
      .select({ wizardCompletedAt: organizationOnboarding.wizardCompletedAt })
      .from(organizationOnboarding)
      .where(eq(organizationOnboarding.organizationId, orgId))
      .limit(1);
    onboardingIncomplete = isAdmin && !onb?.wizardCompletedAt;

    const recent = await getRecentUserTickets(session.user.id, orgId, 3);
    recentForCopilot = recent.map((t) => ({ kind: t.kind, id: t.id, title: t.title, status: t.status }));
  }

  return (
    /* Dot-grid wrapper — full height, relative so content sits above */
    <div
      className="dot-grid relative min-h-full -m-6 md:-m-7 p-6 md:p-7"
    >
      <div className="relative z-10 space-y-8 max-w-4xl">

        {/* Page header */}
        <div>
          <h1
            className="text-[17px] font-semibold tracking-[-0.03em]"
            style={{ color: "var(--ink)" }}
          >
            Welcome back, {session.user.name ?? session.user.email}.
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
            Your AI operations are running — browse the catalog or ask the AI to provision instantly.
          </p>
        </div>

        {/* Admin notice */}
        {isAdmin && (
          <div
            className="rounded-lg border px-4 py-3 flex gap-3 items-start text-[12px]"
            style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ink-3)" }} />
            <span>
              <strong style={{ color: "var(--ink)" }}>Admin view active.</strong>{" "}
              Log in as a non-admin to preview the standard employee view.
            </span>
          </div>
        )}

        {/* No org error */}
        {!orgId ? (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3"
            style={{ background: "var(--surface)", borderColor: "var(--status-denied)", color: "var(--status-denied)" }}
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">Your account has no organization assigned.</p>
          </div>
        ) : (
          <>
            {/* Onboarding prompt */}
            {onboardingIncomplete && (
              <div
                className="rounded-lg border px-4 py-3"
                style={{ background: "var(--surface)", borderColor: "var(--accent)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  Complete organization setup
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
                  Run the guided wizard to connect AI, seed your catalog, and invite your team.
                </p>
                <Link
                  href="/onboarding"
                  className="mt-3 inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)" }}
                >
                  Open onboarding
                </Link>
              </div>
            )}

            {/* Stat cards — 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <StatCard label="Time saved" value="42h" change="↑ 12% this month" />
              <StatCard label="Agents active" value="12" change="All healthy" sparkle />
              <StatCard label="Open requests" value="3" change="2 need action" />
            </div>

            {/* Empty catalog hint */}
            {catalog.length === 0 && isAdmin && (
              <div
                className="rounded-lg border px-4 py-3 text-[12px]"
                style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}
              >
                <p className="font-semibold" style={{ color: "var(--ink)" }}>No catalog available</p>
                <p className="mt-1">
                  Use{" "}
                  <Link href="/onboarding" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                    onboarding
                  </Link>{" "}
                  to generate types with AI or apply a template.
                </p>
              </div>
            )}

            {/* Service catalog */}
            <section aria-label="Service catalog">
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-3"
                style={{ color: "var(--ink-3)" }}
              >
                Service catalog
              </h2>
              <CatalogGroupedTiles catalog={catalog} />
            </section>

            {/* AI Copilot */}
            <HomeCopilot
              recentTickets={recentForCopilot}
              onboardingIncomplete={onboardingIncomplete}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. BentoGrid and its imports are gone.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/home/page.tsx
git commit -m "feat(ui): home page — dot grid bg, stat cards, remove BentoGrid"
```

---

### Task 7: Catalog tiles — new style + shimmer featured tile

**Files:**
- Modify: `src/components/catalog-grouped-tiles.tsx`

- [ ] **Step 1: Rewrite catalog-grouped-tiles.tsx**

```tsx
// src/components/catalog-grouped-tiles.tsx
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
          background: featured ? "rgba(255,102,0,0.08)" : "var(--subtle)",
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
                {/* First tile of first group gets shimmer treatment */}
                <CatalogTile tile={t} featured={gi === 0 && ti === 0} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/catalog-grouped-tiles.tsx
git commit -m "feat(ui): catalog tiles — token classes, shimmer featured tile"
```

---

### Task 8: Sign-in page — align to new design system

**Files:**
- Modify: `src/app/sign-in/page.tsx`

- [ ] **Step 1: Update sign-in/page.tsx**

Replace every hardcoded color and the logo reference. Keep layout, AnimatedGridPattern, and AnimatedBeam exactly as they are — just swap styling:

```tsx
// src/app/sign-in/page.tsx  — key changes only shown; keep existing logic/imports
// Replace:
//   className="bg-[--yc-orange]" → style={{ background: "var(--accent)" }}
//   className="... rounded-full ..." → remove rounded-full, use rounded-md
//   className="... focus-visible:ring-[--yc-orange-dim] ..." → removed (global styles handle it)
//   The old logo text → <Logo size="md" wordmark={false} />
//   border-[--yc-orange] → style={{ borderColor: "var(--accent)" }}
//   text-[--yc-orange] → style={{ color: "var(--accent)" }}
//   bg-white → style={{ background: "var(--surface)" }}
//   text-neutral-900 → style={{ color: "var(--ink)" }}
//   text-neutral-600 / text-neutral-500 → style={{ color: "var(--ink-2)" }}
//   border-neutral-200 → style={{ borderColor: "var(--line)" }}
//   rounded-xl on inputs → rounded-md
//   rounded-2xl on card → rounded-xl
```

Full replacement — update `src/app/sign-in/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { SocialSignIn } from "@/components/social-sign-in";
import { Logo } from "@/components/logo";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { User, Brain, LayoutDashboard, ArrowRight } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: "var(--surface)" }}
    >
      <AnimatedGridPattern />

      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row items-center gap-12 lg:gap-24">

        {/* Left: hook + diagram */}
        <div className="flex-1 flex flex-col gap-6 text-center md:text-left">
          <Logo size="lg" wordmark href="/" className="justify-center md:justify-start" />
          <h1
            className="text-4xl md:text-[52px] font-semibold tracking-[-0.04em] leading-[1.1]"
            style={{ color: "var(--ink)" }}
          >
            Operations on{" "}
            <span style={{ color: "var(--accent)" }}>autopilot.</span>
          </h1>
          <p className="text-[15px] max-w-md mx-auto md:mx-0" style={{ color: "var(--ink-2)" }}>
            Aether Ops connects your team to the tools they need, instantly governed by AI.
          </p>

          {/* Diagram */}
          <div
            className="mt-4 rounded-xl p-6 border hidden md:block"
            style={{ background: "var(--subtle)", borderColor: "var(--line)" }}
          >
            <div className="flex items-center justify-between relative">
              <div className="z-10 p-3 rounded-full border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <User className="w-6 h-6" style={{ color: "var(--ink-2)" }} />
              </div>
              <div className="flex-1 absolute inset-0 z-0">
                <AnimatedBeam duration={3} />
              </div>
              <div className="z-10 p-4 rounded-full border" style={{ background: "var(--surface)", borderColor: "var(--accent)" }}>
                <Brain className="w-8 h-8" style={{ color: "var(--accent)" }} />
              </div>
              <div className="z-10 p-3 rounded-full border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
                <LayoutDashboard className="w-6 h-6" style={{ color: "var(--ink-2)" }} />
              </div>
            </div>
            <div className="flex justify-between mt-4 text-[11px] font-medium" style={{ color: "var(--ink-3)" }}>
              <span>Request</span>
              <span>AI Policy Engine</span>
              <span>Provisioned</span>
            </div>
          </div>
        </div>

        {/* Right: login card */}
        <div
          className="w-full max-w-sm rounded-xl border p-8 shadow-xl"
          style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)", borderColor: "var(--line)", backdropFilter: "blur(20px)" }}
        >
          <h2
            className="text-[17px] font-semibold tracking-[-0.03em] mb-6"
            style={{ color: "var(--ink)" }}
          >
            Sign in
          </h2>

          <form
            method="post"
            action="#"
            className="space-y-4"
            aria-describedby={error ? errorId : undefined}
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const res = await authClient.signIn.email({ email, password });
              setLoading(false);
              if (res.error) { setError(res.error.message ?? "Sign in failed"); return; }
              router.push("/home");
              router.refresh();
            }}
          >
            <div>
              <label
                htmlFor="signin-email"
                className="text-[11px] font-medium block mb-1.5"
                style={{ color: "var(--ink-2)" }}
              >
                Work email
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full rounded-md px-3 py-2 text-[12.5px] border"
                style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="text-[11px] font-medium block mb-1.5"
                style={{ color: "var(--ink-2)" }}
              >
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full rounded-md px-3 py-2 text-[12.5px] border"
                style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>

            {error && (
              <p
                id={errorId}
                className="text-[12px] rounded-md p-2"
                role="alert"
                style={{ background: "rgba(229,83,83,0.08)", color: "var(--status-denied)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Signing in…" : "Continue with email"}
              {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--ink-3)" }}>OR</span>
            <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
          </div>

          <SocialSignIn callbackURL="/home" />

          <p className="mt-6 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
            No account?{" "}
            <Link href="/sign-up" className="font-medium hover:underline" style={{ color: "var(--ink)" }}>
              Request access
            </Link>
            {" · "}
            <Link href="/forgot-password" className="font-medium hover:underline" style={{ color: "var(--ink)" }}>
              Reset password
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/sign-in/page.tsx
git commit -m "feat(ui): sign-in — Geist, token colors, new Logo, aligned input/button styles"
```

---

### Task 9: Token sweep — requests, approvals, changes, profile pages

**Files:**
- Modify: `src/app/(dashboard)/requests/page.tsx`
- Modify: `src/app/(dashboard)/requests/[id]/page.tsx`
- Modify: `src/app/(dashboard)/approvals/page.tsx`
- Modify: `src/app/(dashboard)/changes/page.tsx`
- Modify: `src/app/(dashboard)/changes/[id]/page.tsx`
- Modify: `src/app/(dashboard)/changes/[id]/change-ticket-panel.tsx`
- Modify: `src/app/(dashboard)/changes/new/page.tsx`
- Modify: `src/app/(dashboard)/changes/new/new-change-form.tsx`
- Modify: `src/app/(dashboard)/profile/page.tsx`
- Modify: `src/app/(dashboard)/profile/profile-form.tsx`

**Pattern:** For every file, apply the same substitution:

| Old class / style | New style |
|---|---|
| `bg-white` | `style={{ background: "var(--surface)" }}` |
| `bg-zinc-50` / `bg-neutral-50` | `style={{ background: "var(--subtle)" }}` |
| `bg-zinc-100` / `bg-neutral-100` | `style={{ background: "var(--subtle)" }}` |
| `text-zinc-900` / `text-neutral-900` | `style={{ color: "var(--ink)" }}` |
| `text-zinc-600` / `text-neutral-600` | `style={{ color: "var(--ink-2)" }}` |
| `text-zinc-500` / `text-neutral-500` | `style={{ color: "var(--ink-3)" }}` |
| `text-zinc-400` | `style={{ color: "var(--ink-3)" }}` |
| `border-zinc-200` / `border-neutral-200` | `style={{ borderColor: "var(--line)" }}` |
| `border-zinc-700` / `border-zinc-800` | same — dark mode token auto-applies |
| `dark:bg-zinc-*` / `dark:text-zinc-*` | **remove** — CSS vars handle dark mode |
| `rounded-2xl` on cards | `rounded-lg` |
| `rounded-xl` on inputs | `rounded-md` |
| `text-[--yc-orange]` | `style={{ color: "var(--accent)" }}` |
| `bg-[--yc-orange]` | `style={{ background: "var(--accent)" }}` |
| `border-[--yc-orange]` | `style={{ borderColor: "var(--accent)" }}` |
| `text-red-600` / error states | `style={{ color: "var(--status-denied)" }}` |
| `bg-red-50` / error bg | `style={{ background: "rgba(229,83,83,0.08)" }}` |
| `text-green-*` | `style={{ color: "var(--status-approved)" }}` |

- [ ] **Step 1: Apply the substitution pattern to requests/page.tsx**

Open the file. For every Tailwind color class that matches the table above, convert it to the corresponding `style` prop. Remove all `dark:` prefixed classes.

- [ ] **Step 2: Apply the same pattern to requests/[id]/page.tsx and approval-panel.tsx**

- [ ] **Step 3: Apply to approvals/page.tsx**

- [ ] **Step 4: Apply to all changes/ files**

- [ ] **Step 5: Apply to profile/ files**

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/requests/ src/app/(dashboard)/approvals/ src/app/(dashboard)/changes/ src/app/(dashboard)/profile/
git commit -m "feat(ui): token sweep — requests, approvals, changes, profile"
```

---

### Task 10: Token sweep — all admin pages

**Files:**
- All files under `src/app/(dashboard)/admin/`
- `src/app/(dashboard)/admin/layout.tsx`

- [ ] **Step 1: Apply the token substitution pattern from Task 9 to admin/layout.tsx**

- [ ] **Step 2: Apply to all admin page.tsx and form/button component files**

Work through these files in order:
1. `admin/types/page.tsx` + `request-type-form.tsx` + `delete-type-button.tsx`
2. `admin/users/page.tsx` + `user-role-form.tsx` + `offboard-button.tsx`
3. `admin/roles/page.tsx` + `role-bundle-list.tsx`
4. `admin/access-reviews/page.tsx` + `create-campaign-button.tsx`
5. `admin/app-registry/page.tsx` + `app-registry-list.tsx`
6. `admin/vault/page.tsx` + `vault-form.tsx`
7. `admin/sso/page.tsx` + `sso-form.tsx`
8. `admin/billing/page.tsx`
9. `admin/api-keys/page.tsx` + `create-api-key-form.tsx` + `revoke-button.tsx`
10. `admin/integrations/page.tsx` + `integrations-form.tsx`
11. `admin/invites/page.tsx` + `invite-form.tsx`
12. `admin/routing/page.tsx` + `routing-client.tsx`
13. `admin/ai/page.tsx` + `ai-settings-form.tsx`
14. `admin/audit-log/page.tsx`
15. `admin/audit-export/page.tsx` + `audit-export-client.tsx`
16. `admin/setup-status/page.tsx`
17. `admin/change-templates/page.tsx` + `change-template-form.tsx` + `delete-change-template-button.tsx`

Apply the same substitution table from Task 9 to every file.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/
git commit -m "feat(ui): token sweep — all admin pages and forms"
```

---

### Task 11: Token sweep — analytics, catalog, onboarding, sign-up

**Files:**
- `src/app/(dashboard)/analytics/page.tsx`
- `src/app/(dashboard)/analytics/ai/page.tsx`
- `src/app/(dashboard)/catalog/page.tsx`
- `src/app/(dashboard)/onboarding/page.tsx`
- `src/app/(dashboard)/onboarding/onboarding-wizard.tsx`
- `src/app/sign-up/page.tsx`
- `src/app/sign-up/sign-up-form.tsx`

- [ ] **Step 1: Apply the token substitution pattern from Task 9 to each file**

For `sign-up/page.tsx` and `sign-up-form.tsx`, also swap to the new `<Logo />` component and apply the same input/button styles as the sign-in page (Task 8).

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/analytics/ src/app/(dashboard)/catalog/ src/app/(dashboard)/onboarding/ src/app/sign-up/
git commit -m "feat(ui): token sweep — analytics, catalog, onboarding, sign-up"
```

---

### Task 12: Token sweep — shared components

**Files:**
- `src/components/requests-hub.tsx` (if file exists — check with `ls src/components/`)
- `src/components/requests-hub-search.tsx`
- `src/components/home-copilot.tsx`
- `src/components/sign-out-button.tsx`
- `src/components/social-sign-in.tsx`
- `src/components/toast.tsx`

- [ ] **Step 1: List component files to confirm paths**

```bash
ls src/components/
```

- [ ] **Step 2: Apply the token substitution pattern from Task 9 to each existing component**

Pay special attention to `toast.tsx` — it likely has hardcoded colors for error/success/info states. Map them to status tokens:
- Error toast: `background: "rgba(229,83,83,0.1)"`, `color: "var(--status-denied)"`
- Success toast: `background: "rgba(61,153,112,0.1)"`, `color: "var(--status-approved)"`
- Neutral toast: `background: "var(--subtle)"`, `color: "var(--ink)"`

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Full dev smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Run through:
1. Sign-in page renders cleanly with new logo
2. Dashboard home shows sidebar, dot-grid background, stat cards
3. Navigate to Requests — table rows, status dots, badges look correct
4. Navigate to an Admin page — forms and tables use token colors
5. Toggle OS dark mode — all surfaces flip correctly without any orange/white clash
6. Resize to mobile width — sidebar hides, bottom tab bar appears

- [ ] **Step 5: Final commit**

```bash
git add src/components/
git commit -m "feat(ui): token sweep — shared components; YC UI overhaul complete"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Covered by task |
|---|---|
| Design tokens (§2) | Task 1 |
| Typography — Geist (§3) | Task 2 |
| Logo component (§4) | Task 3 |
| Layout — sidebar + nav (§5) | Tasks 4 & 5 |
| Dot-grid background — home only (§6) | Task 6 |
| Buttons, inputs, stat cards, table rows, badges, catalog tiles (§7) | Tasks 6–12 |
| Magic UI — shimmer, gradient wash, SparklesText (§8) | Tasks 6 & 7 |
| Sign-in page alignment (§9) | Task 8 |
| Dark mode via CSS vars (§10) | Task 1 (tokens) + Tasks 9–12 (dark: class removal) |
| Phase 1 shell (§11) | Tasks 1–5 |
| Phase 2 page sweep (§11) | Tasks 6–12 |

No gaps found.
