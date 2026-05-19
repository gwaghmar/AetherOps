"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
            Connect your team to the tools they need, instantly governed by AI.
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
            className="space-y-4"
            aria-describedby={error ? errorId : undefined}
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              setLoading(false);
              if (error) { setError(error.message ?? "Sign in failed"); return; }
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
                className="w-full rounded-md px-3 py-2 text-[12.5px] border"
                style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>

            {error && (
              <p
                id={errorId}
                className="text-[12px] rounded-md p-2"
                role="alert"
                style={{ background: "color-mix(in srgb, var(--status-denied) 8%, transparent)", color: "var(--status-denied)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[12.5px] font-medium transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
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
