"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { finalizeInviteFromToken } from "@/app/actions/ai-org";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const [inviteLockedEmail, setInviteLockedEmail] = useState(false);
  const errorId = useId();

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/invite/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        email?: string;
        orgName?: string;
        expired?: boolean;
      };
      if (cancelled) return;
      if (data.ok && data.email) {
        setEmail(data.email);
        setInviteLockedEmail(true);
        setInviteOrgName(data.orgName ?? null);
      } else if (data.expired) {
        setError("This invite link has expired. Ask your admin for a new one.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="mb-8">
        <Logo size="md" wordmark href="/" />
      </div>
      <div className="w-full max-w-sm rounded-lg border p-8" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h1 className="text-lg font-semibold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {inviteOrgName ? (
            <>
              You&apos;re joining <strong>{inviteOrgName}</strong>. After sign-up
              we&apos;ll attach your account to that organization.
            </>
          ) : (
            <>
              Your account is assigned to the default organization configured for
              this deployment—unless you used an invite link.
            </>
          )}
        </p>
        <form
          className="mt-6 space-y-4"
          aria-describedby={error ? errorId : undefined}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            const supabase = createClient();
            const { error: err } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: name },
                emailRedirectTo: `${window.location.origin}/api/auth/callback`,
              },
            });
            setLoading(false);
            if (err) {
              setError(err.message ?? "Sign up failed");
              return;
            }
            if (inviteToken) {
              try {
                await finalizeInviteFromToken(inviteToken);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? `Account created, but invite failed: ${err.message}`
                    : "Account created, but invite could not be applied.",
                );
                return;
              }
            }
            router.push("/home");
            router.refresh();
          }}
        >
          <div>
            <label
              htmlFor="signup-name"
              className="text-xs font-medium"
              style={{ color: "var(--ink-2)" }}
            >
              Name
            </label>
            <input
              id="signup-name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <label
              htmlFor="signup-email"
              className="text-xs font-medium"
              style={{ color: "var(--ink-2)" }}
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={inviteLockedEmail}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <label
              htmlFor="signup-password"
              className="text-xs font-medium"
              style={{ color: "var(--ink-2)" }}
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          {error && (
            <p
              id={errorId}
              className="rounded-md px-3 py-2 text-sm"
              style={{ background: "color-mix(in srgb, var(--status-denied) 8%, transparent)", color: "var(--status-denied)" }}
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm" style={{ color: "var(--ink-3)" }}>
          Already have an account?{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
