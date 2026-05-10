"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resubmitRequestAfterInfoAction } from "@/app/actions/requests";
import { useToast } from "@/components/toast";
import {
  parseFieldSchema,
  type FieldSchemaJson,
} from "@/lib/request-schemas";

export function NeedsInfoResubmit({
  requestId,
  fieldSchema,
  initialPayload,
}: {
  requestId: string;
  fieldSchema: unknown;
  initialPayload: Record<string, unknown>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formBaseId = useId();
  const errorId = `${formBaseId}-error`;

  const schema = useMemo((): FieldSchemaJson | null => {
    try {
      return parseFieldSchema(fieldSchema);
    } catch {
      return null;
    }
  }, [fieldSchema]);

  if (!schema) {
    return (
      <p className="text-sm" style={{ color: "var(--status-denied)" }}>
        Cannot edit — invalid field schema for this type.
      </p>
    );
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--status-pending) 30%, transparent)", background: "color-mix(in srgb, var(--status-pending) 8%, transparent)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--status-pending)" }}>
        More information needed
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--status-pending)" }}>
        Update the fields below and resubmit for approval.
      </p>
      <form
        className="mt-4 space-y-3"
        aria-describedby={error ? errorId : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const payload: Record<string, unknown> = {};
          for (const f of schema.fields) {
            payload[f.key] = fd.get(f.key) ?? "";
          }
          setPending(true);
          try {
            const res = await resubmitRequestAfterInfoAction({
              requestId,
              payload,
            });
            if (!res.ok) {
              setError("Check required fields.");
              setPending(false);
              return;
            }
            toast("Resubmitted for approval", "success");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
            toast(err instanceof Error ? err.message : "Failed", "error");
            setPending(false);
          }
        }}
      >
        {schema.fields.map((f) => (
          <div key={f.key}>
            <label
              htmlFor={`resubmit-${f.key}`}
              className="text-xs font-medium" style={{ color: "var(--ink-2)" }}
            >
              {f.label}
              {f.required !== false ? " *" : ""}
            </label>
            {f.type === "textarea" ? (
              <textarea
                id={`resubmit-${f.key}`}
                name={f.key}
                required={f.required !== false}
                rows={4}
                defaultValue={String(initialPayload[f.key] ?? "")}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
              />
            ) : (
              <input
                id={`resubmit-${f.key}`}
                name={f.key}
                required={f.required !== false}
                defaultValue={String(initialPayload[f.key] ?? "")}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
              />
            )}
          </div>
        ))}
        {error && (
          <p id={errorId} className="text-sm" style={{ color: "var(--status-denied)" }} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
        >
          {pending ? "Submitting…" : "Resubmit for approval"}
        </button>
      </form>
    </section>
  );
}
