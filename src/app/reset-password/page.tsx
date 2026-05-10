"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const errorId = useId();

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h1 className="text-lg font-semibold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Your password has been reset. You can now sign in with your new password.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/sign-in" className="underline" style={{ color: "var(--ink-2)" }}>
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <h1 className="text-lg font-semibold tracking-tight">Set new password</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>Enter and confirm your new password.</p>
      <form
        className="mt-6 space-y-4"
        aria-describedby={error ? errorId : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password !== confirm) {
            setError("Passwords do not match");
            return;
          }
          if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
          }
          setLoading(true);
          const supabase = createClient();
          const { error: err } = await supabase.auth.updateUser({ password });
          setLoading(false);
          if (err) {
            setError(err.message ?? "Reset failed. Link may have expired.");
            return;
          }
          setDone(true);
          setTimeout(() => router.push("/sign-in"), 2000);
        }}
      >
        <div>
          <label
            htmlFor="reset-password"
            className="text-xs font-medium"
            style={{ color: "var(--ink-2)" }}
          >
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          />
        </div>
        <div>
          <label
            htmlFor="reset-confirm"
            className="text-xs font-medium"
            style={{ color: "var(--ink-2)" }}
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
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
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <Suspense fallback={<div className="text-sm" style={{ color: "var(--ink-2)" }}>Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
