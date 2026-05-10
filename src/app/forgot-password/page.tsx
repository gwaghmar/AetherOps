"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
        <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <h1 className="text-lg font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
            We sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the link to set a new password.
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/sign-in" className="underline" style={{ color: "var(--ink-2)" }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h1 className="text-lg font-semibold tracking-tight">Forgot password</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <form
          className="mt-6 space-y-4"
          aria-describedby={error ? errorId : undefined}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            const supabase = createClient();
            const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setLoading(false);
            if (err) { setError(err.message); return; }
            setSent(true);
          }}
        >
          <div>
            <label htmlFor="forgot-email" className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>
          {error && (
            <p id={errorId} className="text-sm" role="alert" style={{ color: "var(--status-denied)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/sign-in" className="underline" style={{ color: "var(--ink-2)" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
