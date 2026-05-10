"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen p-8 font-sans antialiased" style={{ background: "var(--canvas)", color: "var(--ink)" }}>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 max-w-lg text-sm" style={{ color: "var(--ink-2)" }}>
          {process.env.NODE_ENV === "development"
            ? error.message
            : "An unexpected error occurred. Please try again."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
