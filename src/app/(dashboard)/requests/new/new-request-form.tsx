"use client";

import Link from "next/link";
import { useEffect, useMemo, useId, useState } from "react";
import { suggestRequestPayloadAction } from "@/app/actions/ai-request-helper";
import { createRequestAction } from "@/app/actions/requests";
import {
  getSimilarRequestsAction,
  type SimilarRequest,
} from "@/app/actions/ai-triage";
import {
  parseFieldSchema,
  type FieldSchemaJson,
} from "@/lib/request-schemas";

export type RequestTypeOption = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  fieldSchema: unknown;
  riskDefaults: unknown;
};

function resolveInitialTypeId(
  types: RequestTypeOption[],
  initialTypeId: string | null | undefined,
): string {
  if (initialTypeId && types.some((t) => t.id === initialTypeId)) {
    return initialTypeId;
  }
  return types[0]?.id ?? "";
}

function emptyValuesForSchema(schema: FieldSchemaJson | null): Record<string, string> {
  if (!schema) return {};
  return Object.fromEntries(schema.fields.map((f) => [f.key, ""]));
}

export function NewRequestForm({
  types,
  initialTypeId = null,
  initialValues = {},
}: {
  types: RequestTypeOption[];
  initialTypeId?: string | null;
  initialValues?: Record<string, string>;
}) {
  const lockedFromUrl =
    Boolean(initialTypeId) && types.some((t) => t.id === initialTypeId);
  const [typeId, setTypeId] = useState(() =>
    resolveInitialTypeId(types, initialTypeId),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialValues);
  const [suggestHint, setSuggestHint] = useState("");
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);
  const [suggestPending, setSuggestPending] = useState(false);
  const [similarRequests, setSimilarRequests] = useState<SimilarRequest[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [duration, setDuration] = useState<string>("permanent"); // hours or "permanent"
  const [isEmergencyOverride, setIsEmergencyOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");


  const selected = types.find((t) => t.id === typeId) ?? types[0];
  const schema = useMemo((): FieldSchemaJson | null => {
    if (!selected) return null;
    try {
      return parseFieldSchema(selected.fieldSchema);
    } catch {
      return null;
    }
  }, [selected]);

  useEffect(() => {
    setFieldValues(emptyValuesForSchema(schema));
    setSuggestMsg(null);
  }, [typeId, schema]);

  useEffect(() => {
    let cancelled = false;
    setSimilarRequests([]);
    setSimilarLoading(true);
    getSimilarRequestsAction(typeId).then((res) => {
      if (cancelled) return;
      setSimilarLoading(false);
      if (res.ok) setSimilarRequests(res.requests);
    });
    return () => { cancelled = true; };
  }, [typeId]);

  const risk = selected?.riskDefaults as Record<string, unknown> | null;
  const formId = useId();
  const submitErrorId = `${formId}-submit-error`;
  const suggestStatusId = `${formId}-suggest-status`;
  const formDescribedBy =
    [submitError && submitErrorId, suggestMsg && suggestStatusId]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {lockedFromUrl
            ? "We prefilled the request type from the catalog. Add the details only you know; everything else is wired for audit and policy."
            : "Choose an intent and fill structured fields. Submission creates an auditable record."}
        </p>
      </div>
      {!selected || !schema ? (
        <p className="text-red-600">Invalid catalog configuration.</p>
      ) : (
        <form
          className="grid gap-6 lg:grid-cols-2"
          aria-describedby={formDescribedBy}
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitError(null);
            const payload: Record<string, unknown> = { ...fieldValues };
            
            let expiresAt: string | null = null;
            if (duration !== "permanent") {
              const hours = parseInt(duration, 10);
              if (!isNaN(hours)) {
                const date = new Date();
                date.setHours(date.getHours() + hours);
                expiresAt = date.toISOString();
              }
            }

            setPending(true);
            try {
              const res = await createRequestAction({
                requestTypeId: typeId,
                payload,
                expiresAt,
                isEmergencyOverride,
                overrideReason: isEmergencyOverride ? overrideReason : undefined,
              });

              if (!res.ok) {
                setSubmitError(
                  "policyDenied" in res
                    ? (res.policyDenied ?? "Policy denied")
                    : "Validation failed — check required fields.",
                );
                setPending(false);
                return;
              }
              window.location.href = `/requests/${res.requestId}`;
            } catch (err) {
              setSubmitError(
                err instanceof Error ? err.message : "Something went wrong",
              );
              setPending(false);
            }
          }}
        >
          <fieldset className="min-w-0 space-y-3.5 border-0 p-0">
            <legend className="sr-only">Request details</legend>
            <div>
              {lockedFromUrl ? (
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Intent
                </div>
              ) : (
                <label
                  htmlFor={`${formId}-intent`}
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Intent
                </label>
              )}
              {lockedFromUrl ? (
                <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {selected.title}
                  </span>
                  <Link
                    href="/requests/new"
                    className="ml-2 text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
                  >
                    Change type
                  </Link>
                </div>
              ) : (
                <select
                  id={`${formId}-intent`}
                  name="requestTypeId"
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  aria-invalid={Boolean(submitError)}
                  aria-describedby={submitError ? submitErrorId : undefined}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              )}
              {selected.description && (
                <p className="mt-1 text-xs text-zinc-500">{selected.description}</p>
              )}
            </div>

            <div
              className="rounded-lg border border-teal-200/80 bg-teal-50/60 p-2.5 dark:border-teal-900/40 dark:bg-teal-950/25"
              aria-labelledby={`${formId}-ai-helper-title`}
            >
              <p
                id={`${formId}-ai-helper-title`}
                className="text-xs font-medium text-teal-950 dark:text-teal-100"
              >
                AI field helper
              </p>
              <p
                id={`${formId}-ai-helper-desc`}
                className="mt-1 text-xs text-teal-900/85 dark:text-teal-200/80"
              >
                Describe what you need in plain language; we suggest values you
                can edit before submit. Requires Admin → AI (or platform key).
              </p>
              <textarea
                id={`${formId}-suggest-hint`}
                value={suggestHint}
                onChange={(e) => setSuggestHint(e.target.value)}
                rows={2}
                placeholder="e.g. Need read-only access to the sales Snowflake mart for Q2 board deck, 30 days"
                aria-describedby={`${formId}-ai-helper-desc`}
                className="mt-2 w-full rounded-lg border border-teal-200/80 bg-white px-2 py-1.5 text-sm dark:border-teal-900/50 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={suggestPending || !suggestHint.trim()}
                onClick={async () => {
                  setSuggestMsg(null);
                  setSuggestPending(true);
                  try {
                    const r = await suggestRequestPayloadAction({
                      requestTypeId: typeId,
                      hint: suggestHint,
                    });
                    if (r.ok) {
                      setFieldValues((prev) => ({ ...prev, ...r.values }));
                      setSuggestMsg(
                        r.usedPlatformFallback
                          ? "Applied suggestions (platform AI key)."
                          : "Applied suggestions — review and edit before submit.",
                      );
                    } else {
                      setSuggestMsg(r.error);
                    }
                  } finally {
                    setSuggestPending(false);
                  }
                }}
                className="mt-2 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-teal-700"
              >
                {suggestPending ? "Suggesting…" : "Suggest fields"}
              </button>
              <div
                id={suggestStatusId}
                className="mt-2 min-h-[1.25rem] text-xs text-teal-900 dark:text-teal-200/90"
                role="status"
                aria-live="polite"
              >
                {suggestMsg ?? ""}
              </div>
            </div>

            <div>
              <label
                htmlFor={`${formId}-duration`}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Access Duration
              </label>
              <select
                id={`${formId}-duration`}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isEmergencyOverride}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 disabled:opacity-50"
              >
                <option value="4">4 hours (Just-in-Time)</option>
                <option value="24">24 hours (1 day)</option>
                <option value="168">7 days (1 week)</option>
                <option value="720">30 days (1 month)</option>
                <option value="permanent">Permanent / Indefinite</option>
              </select>
              {isEmergencyOverride ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  Break-Glass is strictly limited to 4 hours maximum.
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  Access will be automatically revoked after this period.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEmergencyOverride}
                  onChange={(e) => {
                    setIsEmergencyOverride(e.target.checked);
                    if (e.target.checked) setDuration("4");
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-600 dark:border-red-800 dark:bg-zinc-900"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-red-900 dark:text-red-300">
                    Break-Glass Emergency
                  </span>
                  <span className="mt-0.5 text-xs text-red-800 dark:text-red-400">
                    Bypasses all approvals for immediate provisioning. Generates high-severity audit alerts.
                  </span>
                </div>
              </label>

              {isEmergencyOverride && (
                <div className="mt-4 pl-7">
                  <label htmlFor={`${formId}-override-reason`} className="text-xs font-medium text-red-900 dark:text-red-300">
                    Emergency Justification (Required)
                  </label>
                  <textarea
                    id={`${formId}-override-reason`}
                    required
                    rows={2}
                    placeholder="e.g. Incident INC-1234, P1 DB outage"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-800/50 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              )}
            </div>


            {schema.fields.map((f) => {
              const inputClass =
                "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
              const isRequired = f.required !== false;
              const sharedProps = {
                id: `${formId}-field-${f.key}`,
                name: f.key,
                required: isRequired,
                "aria-invalid": Boolean(submitError),
                "aria-describedby": submitError ? submitErrorId : undefined,
                className: inputClass,
              };
              return (
              <div key={f.key}>
                {f.type === "boolean" ? (
                  <label
                    htmlFor={`${formId}-field-${f.key}`}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    <input
                      {...sharedProps}
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={fieldValues[f.key] === "true"}
                      onChange={(e) =>
                        setFieldValues((p) => ({ ...p, [f.key]: e.target.checked ? "true" : "false" }))
                      }
                    />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <label
                      htmlFor={`${formId}-field-${f.key}`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      {f.label}
                      {isRequired ? " *" : ""}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        {...sharedProps}
                        rows={4}
                        placeholder={f.placeholder}
                        value={fieldValues[f.key] ?? ""}
                        onChange={(e) =>
                          setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                      />
                    ) : f.type === "select" ? (
                      <select
                        {...sharedProps}
                        value={fieldValues[f.key] ?? ""}
                        onChange={(e) =>
                          setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                      >
                        <option value="">Select…</option>
                        {(f.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...sharedProps}
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        placeholder={f.placeholder}
                        min={f.min}
                        max={f.max}
                        value={fieldValues[f.key] ?? ""}
                        onChange={(e) =>
                          setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                      />
                    )}
                  </>
                )}
              </div>
              );
            })
            }
            {submitError && (
              <p id={submitErrorId} className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
          </fieldset>
          <aside className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Preview
            </h2>
            <dl className="mt-4 space-y-3">
              {risk &&
                Object.entries(risk).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-zinc-500">{k}</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              {!risk && (
                <p className="text-zinc-500">No risk preview configured.</p>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Policy</dt>
                <dd className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                  Validated on submit when{" "}
                  <code className="text-xs">POLICY_ENGINE_URL</code> is set.
                </dd>
              </div>
            </dl>

            {/* Similar requests */}
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Recent similar requests
              </h2>
              {similarLoading ? (
                <p className="mt-2 text-xs text-zinc-400">Loading…</p>
              ) : similarRequests.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-400">None found.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {similarRequests.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/requests/${r.id}`}
                        className="block rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                            {r.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" },
                                )
                              : ""}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {r.payloadSummary}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
