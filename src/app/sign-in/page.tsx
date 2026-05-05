"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { SocialSignIn } from "@/components/social-sign-in";
import { getPublicAppName } from "@/lib/env";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { User, Brain, LayoutDashboard, Key, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const appName = getPublicAppName();

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-4">
      {/* Magic UI Background */}
      <AnimatedGridPattern />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row items-center gap-12 lg:gap-24">
        
        {/* Left Side: The Hook & Diagram */}
        <div className="flex-1 flex flex-col gap-6 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-900">
            Operations on <span className="text-[--yc-orange]">Autopilot.</span>
          </h1>
          <p className="text-lg text-neutral-600 max-w-md mx-auto md:mx-0">
            {appName} connects your team to the tools they need, instantly governed by AI.
          </p>

          {/* Interactive Diagram: User -> AI -> Output */}
          <div className="mt-8 bg-neutral-50 border border-neutral-100 rounded-2xl p-6 shadow-sm hidden md:block">
            <div className="flex items-center justify-between relative">
              <div className="z-10 bg-white p-3 rounded-full shadow-sm border border-neutral-200">
                <User className="w-6 h-6 text-neutral-700" />
              </div>
              
              <div className="flex-1 absolute inset-0 z-0">
                <AnimatedBeam duration={3} />
              </div>

              <div className="z-10 bg-white p-4 rounded-full shadow-md border border-[--yc-orange]">
                <Brain className="w-8 h-8 text-[--yc-orange]" />
              </div>

              <div className="z-10 bg-white p-3 rounded-full shadow-sm border border-neutral-200">
                <LayoutDashboard className="w-6 h-6 text-neutral-700" />
              </div>
            </div>
            <div className="flex justify-between mt-4 text-xs font-medium text-neutral-500">
              <span>Request</span>
              <span>AI Policy Engine</span>
              <span>Provisioned</span>
            </div>
          </div>
        </div>

        {/* Right Side: The Login Card */}
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur-xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[--yc-orange] p-2 rounded-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Sign In</h2>
          </div>

          <form
            method="post"
            action="#"
            className="space-y-4"
            aria-describedby={error ? errorId : undefined}
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const res = await authClient.signIn.email({
                email,
                password,
              });
              setLoading(false);
              if (res.error) {
                setError(res.error.message ?? "Sign in failed");
                return;
              }
              router.push("/home");
              router.refresh();
            }}
          >
            <div>
              <label
                htmlFor="signin-email"
                className="text-xs font-medium text-neutral-600"
              >
                Work Email
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
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus-visible:ring-2 focus-visible:ring-[--yc-orange-dim]"
              />
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="text-xs font-medium text-neutral-600"
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
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus-visible:ring-2 focus-visible:ring-[--yc-orange-dim]"
              />
            </div>
            
            {error && (
              <p
                id={errorId}
                className="text-sm text-red-600 bg-red-50 p-2 rounded-md"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-[--yc-orange] py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-[#E65C00] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? "Signing in…" : "Continue with Email"}
              {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-neutral-200" />
            <span className="text-xs text-neutral-400 font-medium">OR</span>
            <div className="flex-1 border-t border-neutral-200" />
          </div>

          {/* Social Sign In usually renders its own buttons, we let it do its thing */}
          <div className="[&>button]:rounded-full [&>button]:py-2.5">
            <SocialSignIn callbackURL="/home" />
          </div>

          <p className="mt-8 text-center text-xs text-neutral-500">
            No account?{" "}
            <Link href="/sign-up" className="font-medium text-neutral-900 hover:text-[--yc-orange] transition-colors">
              Request access
            </Link>
            {" · "}
            <Link href="/forgot-password" className="font-medium text-neutral-900 hover:text-[--yc-orange] transition-colors">
              Reset password
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
