import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
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

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 text-sm" style={{ color: "var(--ink-3)" }}>
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
