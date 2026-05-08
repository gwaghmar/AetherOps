"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "requester" | "approver" | "admin";

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

function AdminSection({ role }: { role: Role }) {
  const adminItems = [
    { href: "/admin/types",            label: "Catalog",           icon: Icon.Catalog },
    { href: "/admin/app-registry",     label: "App registry",      icon: Icon.Admin },
    { href: "/admin/routing",          label: "Routing",           icon: Icon.Admin },
    { href: "/admin/roles",            label: "Role bundles",      icon: Icon.Admin },
    { href: "/admin/users",            label: "Users",             icon: Icon.Admin },
    { href: "/admin/invites",          label: "Invites",           icon: Icon.Admin },
    { href: "/admin/access-reviews",   label: "Access reviews",    icon: Icon.Clock },
    { href: "/admin/ai",               label: "AI",                icon: Icon.Admin },
    { href: "/admin/api-keys",         label: "API keys",          icon: Icon.Admin },
    { href: "/admin/vault",            label: "Credential vault",  icon: Icon.Admin },
    { href: "/admin/billing",          label: "Billing",           icon: Icon.Admin },
    { href: "/admin/integrations",     label: "Integrations",      icon: Icon.Admin },
    { href: "/admin/sso",              label: "Enterprise SSO",    icon: Icon.Admin },
    { href: "/admin/audit-log",        label: "Audit log",         icon: Icon.Requests },
    { href: "/admin/audit-export",     label: "Audit export",      icon: Icon.Requests },
    { href: "/admin/setup-status",     label: "Setup status",      icon: Icon.Admin },
    { href: "/admin/change-templates", label: "Change templates",  icon: Icon.Changes },
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

function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/home",         icon: Icon.Home,      label: "Home" },
    { href: "/requests/new", icon: Icon.Requests,  label: "New" },
    { href: "/changes",      icon: Icon.Changes,   label: "Changes" },
    ...(role === "approver" || role === "admin"
      ? [{ href: "/approvals", icon: Icon.Approvals, label: "Approvals" }]
      : []),
    { href: "/catalog",      icon: Icon.Catalog,   label: "Catalog" },
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

export function DashboardNav({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  if (mobile) {
    return <MobileTabBar role={role} />;
  }

  return (
    <nav className="flex flex-col gap-0.5 p-2 flex-1" aria-label="Primary">
      <SidebarItem href="/home"         label="Home"        icon={Icon.Home} />
      <SidebarItem href="/requests"     label="My requests" icon={Icon.Requests} />
      <SidebarItem href="/requests/new" label="New request" icon={Icon.Clock} />
      <SidebarItem href="/changes"      label="Changes"     icon={Icon.Changes} />

      {(role === "approver" || role === "admin") && (
        <>
          <SectionLabel>Review</SectionLabel>
          <SidebarItem href="/approvals" label="Approvals" icon={Icon.Approvals} />
        </>
      )}

      <SectionLabel>Explore</SectionLabel>
      <SidebarItem href="/catalog"   label="Catalog"   icon={Icon.Catalog} />
      <SidebarItem href="/analytics" label="Analytics" icon={Icon.Analytics} />

      <AdminSection role={role} />
    </nav>
  );
}
