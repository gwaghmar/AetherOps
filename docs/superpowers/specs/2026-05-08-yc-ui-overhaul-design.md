# YC UI Overhaul — Design Spec
**Date:** 2026-05-08  
**Status:** Approved — ready for implementation planning  
**Scope:** Full dashboard UI/UX overhaul to YC Modern aesthetic (Linear-inspired)

---

## 1. Design Direction

**Style:** YC Modern — Linear-inspired layout, clean data-dense UI, restrained use of orange, confident Geist typography. Not the brutalist HN look. Not dark-by-default devtools. The aesthetic of a well-funded YC startup's internal ops platform.

**Reference:** Linear.app — compact sidebar, thin hairline borders, status dots, muted badges, flat cards with subtle depth. YC.com — bold wordmarks, orange as the single brand accent, cream background.

---

## 2. Design Tokens

All tokens live in `src/app/globals.css` as CSS custom properties. No hardcoded colors anywhere in components — always reference a token.

### Light mode (default)
```css
--background:        #F6F6EF;  /* YC cream — page background */
--surface:           #FFFFFF;  /* cards, panels, nav */
--surface-secondary: #FAFAFA;  /* main content area bg */
--border:            #E8E8E6;  /* hairline borders */
--border-subtle:     #F0F0EE;  /* table row dividers */

--text-primary:      #0F0F0F;
--text-secondary:    #6B6B6B;
--text-muted:        #AAAAAA;
--text-placeholder:  #C8C8C8;

--accent:            #FF6600;  /* YC orange — single brand accent */
--accent-dim:        rgba(255,102,0,0.12);
--accent-hover:      #E85C00;  /* darken on hover */

--status-pending:    #FF6600;
--status-approved:   #3D9970;
--status-fulfilled:  rgba(61,153,112,0.45);
--status-denied:     #E55353;
```

### Dark mode (`@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`)
```css
--background:        #0A0A0A;
--surface:           #111113;
--surface-secondary: #161618;
--border:            #232326;
--border-subtle:     #1C1C1F;

--text-primary:      #F5F5F5;
--text-secondary:    #8B8B8F;
--text-muted:        #4A4A4F;
--text-placeholder:  #333336;

--accent:            #FF6600;  /* same orange, works on dark */
--accent-dim:        rgba(255,102,0,0.15);
--accent-hover:      #FF7A20;
```

Status colors are the same in dark mode.

---

## 3. Typography

**Font stack:** Geist → system-ui → sans-serif (replaces Inter)  
**Mono font:** Geist Mono (replaces JetBrains Mono)  
**Load:** `next/font/google` — `Geist` and `Geist_Mono`

### Scale
| Role | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| Page heading | 17px | 600 | -0.03em | 1.2 |
| Section heading | 13px | 600 | -0.02em | 1.3 |
| Body / row | 12.5px | 450 | -0.01em | 1.4 |
| Label / meta | 10.5–11px | 500 | 0 to +0.01em | 1.3 |
| Uppercase label | 10px | 600 | +0.04em | 1 |
| Stat value | 25–26px | 600 | -0.04em | 1 |

`font-variant-numeric: tabular-nums` on all numeric stat displays.

---

## 4. Logo

### Mark
- Shape: Rounded square, 9px radius at 40px base size
- Fill: `#FF6600`
- Glyph: Geometric **A** — no crossbar, clean apex — white SVG path
- SVG path (viewBox 0 0 44 44): `M22 8L6 36h7.5L22 18l8.5 18H38L22 8z`

### Sizes
| Context | Square size | Border-radius |
|---|---|---|
| Nav (inline) | 24px | 6px |
| Default | 40px | 9px |
| Large | 56px | 12px |
| Hero / marketing | 80px | 16px |

### Wordmark
- "Aether" — `var(--text-primary)`, weight 600, -0.03em tracking
- " Ops" — `var(--accent)` (#FF6600), same weight
- Font: Geist

### Component
New shared component: `src/components/logo.tsx` — accepts `size` prop (`sm | md | lg | xl`), renders mark + optional wordmark.

---

## 5. Layout Structure

### Top nav (`src/app/(dashboard)/layout.tsx` + `src/components/dashboard-nav.tsx`)
- Height: 44px, sticky, `z-index: 10`
- Background: `var(--surface)` + `backdrop-filter: blur(8px)` + 80% opacity
- Bottom border: `1px solid var(--border)`
- Contents (left → right): Logo (mark + wordmark) · Nav items · `⌘K` pill · Avatar circle
- Nav items: 12.5px Geist 450, `var(--text-secondary)`, rounded-md, hover `var(--surface-secondary)`

### Left sidebar
- Width: 196px, `border-right: 1px solid var(--border)`
- Background: `var(--surface)`
- Section labels: 10px uppercase, `var(--text-muted)`, +0.04em tracking
- Items: icon (14px) + label + optional badge, 5px radius, hover `var(--surface-secondary)`
- Active item: `background: var(--surface-secondary)`, `var(--text-primary)`, icon color `var(--accent)`
- Badges: muted gray pill by default, orange-tinted for items needing action
- **Mobile (< 768px):** sidebar collapses to bottom tab bar — 5 icons only, no labels

### Main content area
- Background: `var(--surface-secondary)`
- Padding: `24px 28px`

### Full shell
```
┌─────────────────────────────────────────────┐
│  nav (44px, sticky)                          │
├──────────┬──────────────────────────────────┤
│ sidebar  │  main content                    │
│ (196px)  │  bg: var(--surface-secondary)    │
│          │  padding: 24px 28px              │
└──────────┴──────────────────────────────────┘
```

---

## 6. Background Pattern

Applied to the **home page only** (not all pages — other pages use flat `var(--surface-secondary)`).

```css
/* In home page or its layout wrapper */
background-color: #F6F6EF;
background-image: radial-gradient(circle, #C8C8B8 1px, transparent 1px);
background-size: 20px 20px;
```

The sidebar and nav remain flat (no dot pattern). The pattern sits behind content using `position: relative; z-index: 1` on content elements.

**Dark mode dot pattern:**
```css
background-color: #0A0A0A;
background-image: radial-gradient(circle, #2A2A2A 1px, transparent 1px);
background-size: 20px 20px;
```

---

## 7. Core Components

### Buttons
```
Primary:   bg #FF6600 · white text · 6px radius · Geist 500 12px · px-13 py-6
           hover: opacity 0.88 · active: scale(0.98)
           
Secondary: bg var(--surface) · 1px border var(--border) · text-secondary
           hover: bg var(--surface-secondary)

Ghost:     no bg, no border · text-secondary · hover: bg var(--surface-secondary)
```
No `rounded-full` pill on primary buttons inside the dashboard — pills are reserved for badges.

### Inputs / form fields
```
Border:     1px solid var(--border)
Radius:     6px
Padding:    px-3 py-2
Font:       12.5px Geist 400
Focus ring: box-shadow 0 0 0 2px var(--surface), 0 0 0 4px var(--accent-dim)
Disabled:   opacity 0.5, cursor not-allowed
```

### Stat cards
```
bg: var(--surface)
border: 1px solid var(--border)
radius: 8px
padding: 13px 15px
Magic UI touch: linear-gradient(135deg, rgba(255,102,0,0.03) 0%, transparent 60%) overlay
```

### Table rows
```
border-bottom: 1px solid var(--border-subtle)
hover: bg var(--surface-secondary)
padding: 8px 13px
Status dot: 7px circle, colors from --status-* tokens
            box-shadow: 0 0 0 2px <status-color-at-15%-opacity>
```

### Status badges
```
pending:   bg rgba(255,102,0,0.10) · color #CC5200
approved:  bg rgba(61,153,112,0.10) · color #276D4E
fulfilled: bg var(--surface-secondary) · color var(--text-muted)
denied:    bg rgba(229,83,83,0.08) · color #C04040
radius: 4px · padding: 2px 7px · font: 10.5px Geist 500
```

### Catalog tiles
```
bg: var(--surface)
border: 1px solid var(--border)
radius: 7px
padding: 11px
hover: border-color #D4D4D0, shadow 0 2px 8px rgba(0,0,0,0.05)

Featured tile (Magic UI shimmer border):
  border: transparent
  background: linear-gradient(white, white) padding-box,
              linear-gradient(90deg, #ebebeb 0%, #FF6600 50%, #ebebeb 100%) border-box
  background-size: 200% auto
  animation: shimmer-border 2.5s linear infinite
```

---

## 8. Magic UI — Approved Usage

Keep existing components, tighten their usage:

| Component | Where | Treatment |
|---|---|---|
| `AnimatedGridPattern` | Sign-in page background | Keep as-is |
| Shimmer border (CSS) | Featured catalog tile on home | CSS animation, no extra dep |
| Gradient wash (CSS) | Stat cards | Pure CSS `::before` overlay |
| `SparklesText` | One moment on home (e.g. agent count) | Keep, don't overuse |
| `BentoGrid` | **Remove** from home — replace with simple 3-col stat row | Simpler, less "AI slop" |
| `AnimatedBeam` | Sign-in diagram | Keep |

---

## 9. Sign-in Page

Align with new system — don't redesign layout, just update tokens:
- Font → Geist
- Colors → new token set
- Logo → new `<Logo />` component
- Button → new primary button style (remove `rounded-full`, use `rounded-md`)
- Inputs → new input style
- Keep `AnimatedGridPattern` background

---

## 10. Dark Mode Implementation

Strategy: CSS custom properties only — no component-level `dark:` class sprawl.

1. Define all tokens in `globals.css` under `:root` (light) and `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]` (dark)
2. During page sweep, replace `dark:bg-zinc-900`, `dark:text-zinc-400`, etc. with `bg-[var(--surface)]`, `text-[var(--text-secondary)]`
3. System preference respected automatically; manual toggle can be added later via `data-theme` on `<html>`

---

## 11. Implementation Phases

### Phase 1 — Shell (all blocking, do first)
1. `globals.css` — full token set, dot grid CSS, dark mode vars, transition defaults
2. `src/app/layout.tsx` — swap Inter → Geist, Geist Mono; update metadata
3. `src/components/logo.tsx` — new logo component (mark + wordmark, size prop)
4. `src/app/(dashboard)/layout.tsx` — sidebar + top nav restructure
5. `src/components/dashboard-nav.tsx` — sidebar version with icons, badges, section labels
6. Mobile nav — bottom tab bar for `< 768px`

### Phase 2 — Pages (sweep in order)
1. `home/page.tsx` — dot bg, new stat cards (replace BentoGrid), request list
2. `requests/page.tsx` + `requests/[id]/page.tsx`
3. `approvals/page.tsx`
4. `changes/` pages
5. `catalog/page.tsx`
6. `sign-in/page.tsx` + `sign-up/page.tsx`
7. `admin/*` pages (many files — sweep systematically)
8. Shared components: `catalog-grouped-tiles`, `requests-hub`, `home-copilot`

### Out of scope (separate specs)
- Firebase/database migration
- New features or functionality
- E2E test updates

---

## 12. Decisions Log

| Question | Decision |
|---|---|
| Direction | YC Modern (Linear-inspired) |
| Orange | `#FF6600` full YC orange |
| Font | Geist (replaces Inter + JetBrains Mono) |
| Logo | Orange square + geometric A, "Aether Ops" wordmark |
| Layout | Sidebar + top nav (not horizontal-only) |
| Background | YC cream `#F6F6EF` + dot grid on home |
| Dark mode | Yes — CSS variable approach |
| Magic UI | Keep but restrain; remove BentoGrid from home |
| Sign-in | Keep layout, align to new tokens |
| Scope | Shell first → page sweep |
| Firebase | Out of scope — separate discussion |
