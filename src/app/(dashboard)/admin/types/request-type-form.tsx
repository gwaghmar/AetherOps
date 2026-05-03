"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminCreateRequestType,
  adminUpdateRequestType,
} from "@/app/actions/admin";
import { useToast } from "@/components/toast";

type Mode = "create" | "edit";

export function RequestTypeForm(props: {
  mode: Mode;
  initial?: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    fieldSchema: unknown;
    riskDefaults: unknown;
    connectorId: string | null;
  };
}) {
  const [slug, setSlug] = useState(props.initial?.slug ?? "");
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [description, setDescription] = useState(
    props.initial?.description ?? "",
  );
  const [fieldSchemaJson, setFieldSchemaJson] = useState(
    props.initial
      ? JSON.stringify(props.initial.fieldSchema, null, 2)
      : '{\n  "fields": []\n}',
  );
  const [riskDefaultsJson, setRiskDefaultsJson] = useState(
    props.initial
      ? JSON.stringify(props.initial.riskDefaults, null, 2)
      : "{}",
  );
  const [connectorId, setConnectorId] = useState(
    props.initial?.connectorId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const uid = useId();
  const idSlug = `${uid}-slug`;
  const idTitle = `${uid}-title`;
  const idDesc = `${uid}-desc`;
  const idFs = `${uid}-fs`;
  const idRd = `${uid}-rd`;
  const idConn = `${uid}-conn`;
  const errorId = `${uid}-error`;

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
      aria-describedby={error ? errorId : undefined}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          if (props.mode === "create") {
            await adminCreateRequestType({
              slug,
              title,
              description: description || undefined,
              fieldSchemaJson,
              riskDefaultsJson,
              connectorId: connectorId || null,
            });
          } else if (props.initial) {
            await adminUpdateRequestType({
              id: props.initial.id,
              slug,
              title,
              description: description || undefined,
              fieldSchemaJson,
              riskDefaultsJson,
              connectorId: connectorId || null,
            });
          }
          const verb = props.mode === "create" ? "created" : "updated";
          toast(`Request type ${verb}`, "success");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
          toast(err instanceof Error ? err.message : "Save failed", "error");
          setPending(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={idSlug} className="text-xs font-medium">
            Slug
          </label>
          <input
            id={idSlug}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            pattern="[a-z0-9_-]+"
          />
        </div>
        <div>
          <label htmlFor={idTitle} className="text-xs font-medium">
            Title
          </label>
          <input
            id={idTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </div>
      <div>
        <label htmlFor={idDesc} className="text-xs font-medium">
          Description
        </label>
        <input
          id={idDesc}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor={idFs} className="text-xs font-medium">
          field_schema (JSON)
        </label>
        <textarea
          id={idFs}
          required
          rows={8}
          value={fieldSchemaJson}
          onChange={(e) => setFieldSchemaJson(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor={idRd} className="text-xs font-medium">
          risk_defaults (JSON)
        </label>
        <textarea
          id={idRd}
          required
          rows={4}
          value={riskDefaultsJson}
          onChange={(e) => setRiskDefaultsJson(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor={idConn} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Provisioning Connector
        </label>
        <select
          id={idConn}
          value={connectorId}
          onChange={(e) => setConnectorId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none ring-zinc-500/10 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">Default (PROVISION_CONNECTOR env)</option>
          <option value="stub">Stub (no-op)</option>
          <option value="manual_ticketing">Manual Action Required</option>
          <option value="github">GitHub</option>
          <option value="aws">AWS</option>
          <option value="slack">Slack</option>
          <option value="linear">Linear</option>
          <option value="vercel">Vercel</option>
          <option value="openai">OpenAI</option>
          <option value="notion">Notion</option>
          <option value="stripe">Stripe</option>
          <option value="http_webhook">HTTP Webhook</option>
          <option value="log">Log to Console</option>
        </select>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : props.mode === "create" ? "Create type" : "Save"}
      </button>
    </form>
  );
}
