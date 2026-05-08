"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  advanceChangeTicketStageAction,
  moveChangeTicketToOnDeckAction,
  updateChangeTicketAssigneeAction,
  updateChangeTicketDraftAction,
} from "@/app/actions/change-tickets";
import { useToast } from "@/components/toast";
import {
  parseFieldSchema,
  type FieldSchemaJson,
} from "@/lib/request-schemas";
import {
  CHANGE_TICKET_STAGES,
  STAGE_LABELS,
  type ChangeTicketStage,
} from "@/lib/change-ticket-stages";

export type OrgMemberOption = {
  id: string;
  email: string;
  name: string;
};

export function ChangeTicketPanel({
  ticketId,
  stage,
  title: initialTitle,
  payload: initialPayload,
  fieldSchemaJson,
  members,
  assigneeId: initialAssignee,
  advanceLabel,
  canAdvance,
  canMoveToDeck,
  canEditDraft,
  canUpdateAssignee,
}: {
  ticketId: string;
  stage: ChangeTicketStage;
  title: string;
  payload: Record<string, unknown>;
  fieldSchemaJson: unknown;
  members: OrgMemberOption[];
  assigneeId: string | null;
  advanceLabel: string | null;
  canAdvance: boolean;
  canMoveToDeck: boolean;
  canEditDraft: boolean;
  canUpdateAssignee: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [assigneeId, setAssigneeId] = useState(initialAssignee ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const panelBaseId = useId();
  const panelErrorId = `${panelBaseId}-panel-error`;
  const assigneeSelectId = `${panelBaseId}-assignee`;
  const draftTitleId = `${panelBaseId}-draft-title`;
  const workflowCommentId = `${panelBaseId}-workflow-comment`;

  const schema = useMemo((): FieldSchemaJson | null => {
    try {
      return parseFieldSchema(fieldSchemaJson);
    } catch {
      return null;
    }
  }, [fieldSchemaJson]);

  const stageIndex = CHANGE_TICKET_STAGES.indexOf(stage);

  async function reload(message?: string) {
    if (message) toast(message, "success");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Pipeline" className="flex flex-wrap gap-1 text-xs">
        {CHANGE_TICKET_STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <span
              key={s}
              className="rounded-full px-2 py-1"
              style={
                current
                  ? { background: "var(--status-approved)", color: "var(--ink-on-accent)" }
                  : done
                    ? { background: "var(--subtle)", color: "var(--ink-2)" }
                    : { border: "1px solid var(--line)", color: "var(--ink-3)" }
              }
            >
              {STAGE_LABELS[s]}
            </span>
          );
        })}
      </nav>

      {canUpdateAssignee && (
        <section
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <h2 className="text-sm font-semibold">Assignee</h2>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label htmlFor={assigneeSelectId} className="sr-only">
              Assignee
            </label>
            <select
              id={assigneeSelectId}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            >
              <option value="">— Unassigned —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await updateChangeTicketAssigneeAction({
                    ticketId,
                    assignedUserId: assigneeId,
                  });
                  await reload("Assignee saved");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                  setPending(false);
                }
              }}
              className="rounded-lg border px-3 py-2 text-sm hover:opacity-80"
              style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
            >
              Save assignee
            </button>
          </div>
        </section>
      )}

      {canEditDraft && schema && (
        <section
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <h2 className="text-sm font-semibold">Edit draft</h2>
          <form
            className="mt-3 space-y-3"
            aria-describedby={error ? panelErrorId : undefined}
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
                const res = await updateChangeTicketDraftAction({
                  ticketId,
                  title: title.trim() || "Change",
                  payload,
                  assignedUserId: assigneeId || undefined,
                });
                if (!res.ok) {
                  setError("Check required fields.");
                  setPending(false);
                  return;
                }
                await reload("Draft saved");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
                setPending(false);
              }
            }}
          >
            <div>
              <label
                htmlFor={draftTitleId}
                className="text-xs font-medium"
                style={{ color: "var(--ink-2)" }}
              >
                Title
              </label>
              <input
                id={draftTitleId}
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? panelErrorId : undefined}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
              />
            </div>
            {schema.fields.map((f) => (
              <div key={f.key}>
                <label
                  htmlFor={`${panelBaseId}-draft-${f.key}`}
                  className="text-xs font-medium"
                  style={{ color: "var(--ink-2)" }}
                >
                  {f.label}
                  {f.required !== false ? " *" : ""}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`${panelBaseId}-draft-${f.key}`}
                    name={f.key}
                    required={f.required !== false}
                    rows={4}
                    defaultValue={String(initialPayload[f.key] ?? "")}
                    placeholder={f.placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? panelErrorId : undefined}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                  />
                ) : (
                  <input
                    id={`${panelBaseId}-draft-${f.key}`}
                    name={f.key}
                    required={f.required !== false}
                    defaultValue={String(initialPayload[f.key] ?? "")}
                    placeholder={f.placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? panelErrorId : undefined}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                  />
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
            >
              Save draft
            </button>
          </form>
        </section>
      )}

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <h2 className="text-sm font-semibold">Workflow actions</h2>
        {error && (
          <p id={panelErrorId} className="mt-2 text-sm" role="alert" style={{ color: "var(--status-denied)" }}>
            {error}
          </p>
        )}
        <label htmlFor={workflowCommentId} className="sr-only">
          Optional workflow comment
        </label>
        <textarea
          id={workflowCommentId}
          placeholder="Optional comment (included in audit on advance)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          aria-describedby={error ? panelErrorId : undefined}
          className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {canMoveToDeck && (
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await moveChangeTicketToOnDeckAction({ ticketId });
                  await reload("Moved to On deck");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                  setPending(false);
                }
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}
            >
              Move to On deck
            </button>
          )}
          {canAdvance && advanceLabel && (
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await advanceChangeTicketStageAction({
                    ticketId,
                    comment: comment || undefined,
                  });
                  await reload(advanceLabel ?? "Stage advanced");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                  setPending(false);
                }
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--status-approved)", color: "var(--ink-on-accent)" }}
            >
              {advanceLabel}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
