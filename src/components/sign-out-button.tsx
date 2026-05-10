"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      }}
      className="text-sm underline underline-offset-2"
      style={{ color: "var(--ink-3)" }}
    >
      Sign out
    </button>
  );
}
