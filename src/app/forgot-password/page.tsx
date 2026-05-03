"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { getPublicAppName } from "@/lib/env";

const appName = getPublicAppName();

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-zinc-500">
            We sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the link to set a new password.
          </p>
          <p className="mt-4 text-center text-sm text-zinc-500">
            <Link href="/sign-in" className="underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold tracking-tight">Forgot password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your {appName} email and we&#39;ll send you a reset link.
        </p>
        <form
          method="post"
          action="#"
          className="mt-6 space-y-4"
          aria-describedby={error ? errorId : undefined}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            const res = await fetch("/api/auth/request-password-reset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, redirectTo: "/reset-password" }),
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);
            if (!res.ok) {
              setError((data as { message?: string }).message ?? "Failed to send reset email");
              return;
            }
            setSent(true);
          }}
        >
          <div>
            <label
              htmlFor="forgot-email"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {error && (
            <p
              id={errorId}
              className="text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          <Link href="/sign-in" className="underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
