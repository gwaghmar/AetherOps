import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPublicAppName } from "@/lib/env";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/home");

  const appName = getPublicAppName();

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--ink)" }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-10 backdrop-blur"
        style={{ borderBottom: "1px solid var(--line)", background: "rgba(246,246,239,0.92)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            {appName}
          </span>
          <div className="flex gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{ color: "var(--ink-2)" }}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <div
          className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs"
          style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          AI-native IT governance — built for modern teams
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl" style={{ color: "var(--ink)" }}>
          Requests, approvals &amp; change control
          <br />
          <span style={{ color: "var(--accent)" }}>without the ServiceNow bill</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "var(--ink-2)" }}>
          {appName} replaces legacy ITSM ticketing with an AI-first platform.
          Submit IT requests in plain English, get risk-triaged automatically,
          and close change tickets with a full audit trail—in minutes, not days.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="rounded-xl px-6 py-3 text-sm font-semibold shadow-sm transition-colors"
            style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
          >
            Start for free →
          </Link>
          <Link
            href="/sign-in"
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
            style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            Sign in to your workspace
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "AI auto-triage", desc: "Every request is classified low / medium / high / critical by LLM — low-risk items auto-approve without human latency.", icon: "✦" },
            { title: "Structured catalog", desc: "Define request types with rich fields (text, select, date, number). The AI field helper fills forms from natural language input.", icon: "⬡" },
            { title: "Approval routing", desc: "Rule-based approval chains, email one-click approve/deny, and AI-recommended reviewers based on history.", icon: "⊕" },
            { title: "Change control", desc: "Linear change-ticket pipeline with stages, assignees, and draft/review/approve workflow—all audited.", icon: "◈" },
            { title: "Full audit trail", desc: "Every action recorded. Export to CSV or PDF for compliance and security reviews.", icon: "◉" },
            { title: "BYOK AI", desc: "Bring your own OpenAI/compatible key per organization. Isolated, encrypted at rest, never shared.", icon: "⬣" },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-5"
              style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
            >
              <span className="text-xl" style={{ color: "var(--accent)" }}>{f.icon}</span>
              <h3 className="mt-3 font-semibold" style={{ color: "var(--ink)" }}>{f.title}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="py-16" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--subtle)" }}>
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8 px-4 text-center">
          {[
            { value: "< 30s", label: "Avg. time to triage" },
            { value: "100%", label: "Requests audited" },
            { value: "BYOK", label: "AI key isolation" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>{s.value}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <h2 className="text-3xl font-bold" style={{ color: "var(--ink)" }}>
          Ready to replace your ticket queue?
        </h2>
        <p className="mx-auto mt-4 max-w-md" style={{ color: "var(--ink-2)" }}>
          Set up in minutes. Works with your existing approvers, email, and webhooks. No consulting required.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-xl px-8 py-3 font-semibold transition-colors"
          style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
        >
          Create a free workspace →
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-xs" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}>
        &copy; {new Date().getFullYear()} {appName} · Built for the AI era of IT governance
      </footer>
    </div>
  );
}
