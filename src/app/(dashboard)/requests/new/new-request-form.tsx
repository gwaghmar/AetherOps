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

const inputStyle = {
  border: "1px solid var(--line)",
  background: "var(--subtle)",
  color: "var(--ink)",
};

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
  const [duration, setDuration] = useState<string>("permanent");
  const [isEmergencyOverride, setIsEmergencyOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [requesterNote, setRequesterNote] = useState("");

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
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>New request</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          {lockedFromUrl
            ? "We prefilled the request type from the catalog. Add the details only you know; everything else is wired for audit and policy."
            : "Choose an intent and fill structured fields. Submission creates an auditable record."}
        </p>
      </div>
      {!selected || !schema ? (
        <p style={{ color: "var(--status-denied)" }}>Invalid catalog configuration.</p>
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
                requesterNote: requesterNote || undefined,
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
                <div className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>Intent</div>
              ) : (
                <label htmlFor={`${formId}-intent`} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                  Intent
                </label>
              )}
              {lockedFromUrl ? (
                <div className="mt-1 rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <span className="font-medium" style={{ color: "var(--ink)" }}>{selected.title}</span>
                  <Link href="/requests/new" className="ml-2 text-xs font-medium underline" style={{ color: "var(--ink-2)" }}>
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
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )}
              {selected.description && (
                <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>{selected.description}</p>
              )}
            </div>

            {/* AI field helper */}
            <div
              className="rounded-lg p-2.5"
              style={{ border: "1px solid var(--accent-dim)", background: "var(--accent-dim)" }}
              aria-labelledby={`${formId}-ai-helper-title`}
            >
              <p id={`${formId}-ai-helper-title`} className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                AI field helper
              </p>
              <p id={`${formId}-ai-helper-desc`} className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
                Describe what you need in plain language; we suggest values you can edit before submit.
              </p>
              <textarea
                id={`${formId}-suggest-hint`}
                value={suggestHint}
                onChange={(e) => setSuggestHint(e.target.value)}
                rows={2}
                placeholder="e.g. Need read-only access to the sales Snowflake mart for Q2 board deck, 30 days"
                aria-describedby={`${formId}-ai-helper-desc`}
                className="mt-2 w-full rounded-lg px-2 py-1.5 text-sm"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={suggestPending || !suggestHint.trim()}
                onClick={async () => {
                  setSuggestMsg(null);
                  setSuggestPending(true);
                  try {
                    const r = await suggestRequestPayloadAction({ requestTypeId: typeId, hint: suggestHint });
                    if (r.ok) {
                      setFieldValues((prev) => ({ ...prev, ...r.values }));
                      setSuggestMsg(r.usedPlatformFallback ? "Applied suggestions (platform AI key)." : "Applied suggestions — review and edit before submit.");
                    } else {
                      setSuggestMsg(r.error);
                    }
                  } finally {
                    setSuggestPending(false);
                  }
                }}
                className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
              >
                {suggestPending ? "Suggesting…" : "Suggest fields"}
              </button>
              <div id={suggestStatusId} className="mt-2 min-h-[1.25rem] text-xs" style={{ color: "var(--ink-2)" }} role="status" aria-live="polite">
                {suggestMsg ?? ""}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label htmlFor={`${formId}-duration`} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                Access Duration
              </label>
              <select
                id={`${formId}-duration`}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isEmergencyOverride}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                style={inputStyle}
              >
                <option value="4">4 hours (Just-in-Time)</option>
                <option value="24">24 hours (1 day)</option>
                <option value="168">7 days (1 week)</option>
                <option value="720">30 days (1 month)</option>
                <option value="permanent">Permanent / Indefinite</option>
              </select>
              {isEmergencyOverride ? (
                <p className="mt-1 text-xs font-medium" style={{ color: "var(--status-denied)" }}>
                  Break-Glass is strictly limited to 4 hours maximum.
                </p>
              ) : (
                <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
                  Access will be automatically revoked after this period.
                </p>
              )}
            </div>

            {/* Break-glass */}
            <div className="rounded-lg p-4" style={{ border: "1px solid #fca5a5", background: "#fff1f2" }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEmergencyOverride}
                  onChange={(e) => {
                    setIsEmergencyOverride(e.target.checked);
                    if (e.target.checked) setDuration("4");
                  }}
                  className="mt-0.5 h-4 w-4 rounded"
                  style={{ accentColor: "var(--status-denied)" }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: "#7f1d1d" }}>Break-Glass Emergency</span>
                  <span className="mt-0.5 text-xs" style={{ color: "#991b1b" }}>
                    Bypasses all approvals for immediate provisioning. Generates high-severity audit alerts.
                  </span>
                </div>
              </label>
              {isEmergencyOverride && (
                <div className="mt-4 pl-7">
                  <label htmlFor={`${formId}-override-reason`} className="text-xs font-medium" style={{ color: "#7f1d1d" }}>
                    Emergency Justification (Required)
                  </label>
                  <textarea
                    id={`${formId}-override-reason`}
                    required
                    rows={2}
                    placeholder="e.g. Incident INC-1234, P1 DB outage"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="mt-1 block w-full rounded-md px-3 py-2 text-sm"
                    style={{ border: "1px solid #fca5a5", background: "#fff", color: "var(--ink)" }}
                  />
                </div>
              )}
            </div>

            {/* Dynamic fields */}
            {schema.fields.map((f) => {
              const isRequired = f.required !== false;
              const sharedProps = {
                id: `${formId}-field-${f.key}`,
                name: f.key,
                required: isRequired,
                "aria-invalid": Boolean(submitError),
                "aria-describedby": submitError ? submitErrorId : undefined,
                className: "mt-1 w-full rounded-lg px-3 py-2 text-sm",
                style: inputStyle,
              };
              return (
                <div key={f.key}>
                  {f.type === "boolean" ? (
                    <label htmlFor={`${formId}-field-${f.key}`} className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                      <input
                        {...sharedProps}
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        style={{}}
                        checked={fieldValues[f.key] === "true"}
                        onChange={(e) => setFieldValues((p) => ({ ...p, [f.key]: e.target.checked ? "true" : "false" }))}
                      />
                      {f.label}
                    </label>
                  ) : (
                    <>
                      <label htmlFor={`${formId}-field-${f.key}`} className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                        {f.label}{isRequired ? " *" : ""}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea {...sharedProps} rows={4} placeholder={f.placeholder} value={fieldValues[f.key] ?? ""} onChange={(e) => setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                      ) : f.type === "select" ? (
                        <select {...sharedProps} value={fieldValues[f.key] ?? ""} onChange={(e) => setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))}>
                          <option value="">Select…</option>
                          {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input {...sharedProps} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} placeholder={f.placeholder} min={f.min} max={f.max} value={fieldValues[f.key] ?? ""} onChange={(e) => setFieldValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div>
              <label
                htmlFor={`${formId}-note`}
                className="text-xs font-medium"
                style={{ color: "var(--ink-2)" }}
              >
                Note to approvers{" "}
                <span style={{ color: "var(--ink-3)" }}>(optional)</span>
              </label>
              <textarea
                id={`${formId}-note`}
                rows={3}
                maxLength={2000}
                value={requesterNote}
                onChange={(e) => setRequesterNote(e.target.value)}
                placeholder="Add context that will help approvers decide faster…"
                className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm"
                style={inputStyle}
              />
            </div>

            {submitError && (
              <p id={submitErrorId} className="text-sm" style={{ color: "var(--status-denied)" }} role="alert">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--ink-on-accent)" }}
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
          </fieldset>

          {/* Preview sidebar */}
          <aside className="rounded-xl p-4 text-sm" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>Preview</h2>
            <dl className="mt-4 space-y-3">
              {risk && Object.entries(risk).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs" style={{ color: "var(--ink-3)" }}>{k}</dt>
                  <dd className="mt-0.5" style={{ color: "var(--ink)" }}>{String(v)}</dd>
                </div>
              ))}
              {!risk && <p style={{ color: "var(--ink-3)" }}>No risk preview configured.</p>}
              <div>
                <dt className="text-xs" style={{ color: "var(--ink-3)" }}>Policy</dt>
                <dd className="mt-0.5" style={{ color: "var(--ink-2)" }}>
                  Validated on submit when <code className="text-xs">POLICY_ENGINE_URL</code> is set.
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>Recent similar requests</h2>
              {similarLoading ? (
                <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>Loading…</p>
              ) : similarRequests.length === 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>None found.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {similarRequests.map((r) => (
                    <li key={r.id}>
                      <Link href={`/requests/${r.id}`} className="block rounded-lg px-3 py-2 transition-colors" style={{ border: "1px solid var(--line)", background: "var(--subtle)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full px-1.5 py-0.5 text-xs" style={{ background: "var(--line)", color: "var(--ink-2)" }}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs" style={{ color: "var(--ink-2)" }}>{r.payloadSummary}</p>
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
