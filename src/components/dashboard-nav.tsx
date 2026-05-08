"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Role = "requester" | "approver" | "admin";

type NavItem = {
  href: string;
  label: string;
};

const baseItems: NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/requests/new", label: "New request" },
  { href: "/changes", label: "Change releases" },
  { href: "/changes/new", label: "New change" },
];

const approverItems: NavItem[] = [{ href: "/approvals", label: "Approvals" }];

const adminItems: NavItem[] = [
  { href: "/admin/types", label: "Catalog" },
  { href: "/admin/app-registry", label: "App registry" },
  { href: "/admin/change-templates", label: "Change templates" },
  { href: "/admin/routing", label: "Routing" },
  { href: "/admin/roles", label: "Role bundles & JML" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/access-reviews", label: "Access reviews" },
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/api-keys", label: "API keys" },
  { href: "/admin/vault", label: "Credential vault" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/setup-status", label: "Setup status" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/audit-export", label: "Audit export" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/sso", label: "Enterprise SSO" },
  { href: "/analytics", label: "Analytics" },
];

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, className }: NavItem & { className?: string }) {
  const pathname = usePathname();
  const active = matchesPath(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1.5 transition-colors ${className || ""} ${
        active
          ? "bg-zinc-200/80 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/50"
      }`}
    >
      {label}
    </Link>
  );
}

export function DashboardNav({ role, mobile: _mobile }: { role: Role; mobile?: boolean }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown when navigating
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setAdminOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!adminOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAdminOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [adminOpen]);

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm">
      {baseItems.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
      {(role === "approver" || role === "admin") &&
        approverItems.map((item) => <NavLink key={item.href} {...item} />)}
      {role === "admin" && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={adminOpen}
            onClick={() => setAdminOpen((o) => !o)}
            className="rounded-md px-2 py-1 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Admin
          </button>
          {adminOpen && (
            <div
              role="menu"
              aria-label="Admin navigation"
              className="absolute left-0 top-8 z-20 w-52 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {adminItems.map((item) => (
                <div key={item.href} role="menuitem">
                  <NavLink {...item} className="block w-full text-left" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
