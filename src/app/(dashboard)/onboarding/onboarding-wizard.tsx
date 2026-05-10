"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminCreateInvite,
  adminUpdateOrganizationDisplayName,
  loadCatalogTemplateAction,
  markOnboardingComplete,
  mergeOnboardingSteps,
  onboardingApplyCatalogProposal,
  onboardingGenerateCatalogProposal,
} from "@/app/actions/ai-org";
import type { CatalogProposal } from "@/server/ai/catalog-proposal-schema";

type TemplateOpt = { id: string; label: string };

const sectionStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
};

const inputStyle = {
  borderColor: "var(--line)",
  background: "transparent",
};

const primaryBtnStyle = {
  background: "var(--accent)",
  color: "var(--ink-on-accent)",
};

export function OnboardingWizard({
  orgName,
  aiConfigured,
  templateOptions,
  existingTypeCount,
}: {
  orgName: string;
  aiConfigured: boolean;
  templateOptions: TemplateOpt[];
  existingTypeCount: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState(orgName);
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [refinement, setRefinement] = useState("");
  const [catalogMode, setCatalogMode] = useState<"ai" | "template" | null>(
    null,
  );
  const [templateId, setTemplateId] = useState(templateOptions[0]?.id ?? "");
  const [proposal, setProposal] = useState<CatalogProposal | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"requester" | "approver" | "admin">(
    "requester",
  );
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sendInviteEmail, setSendInviteEmail] = useState(false);

  const next = () => setStep((s) => s + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Organization setup
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          AI-assisted onboarding. Nothing is applied until you confirm each
          step.{" "}
          <Link href="/admin/ai" className="underline">
            Connect AI
          </Link>{" "}
          first if you want generated catalogs.
        </p>
      </div>

      {step === 0 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Welcome</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            We will set your organization display name, seed the service catalog
            (template or AI), point you at routing and integrations, and help
            you invite teammates.
          </p>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            AI status:{" "}
            <span style={{ color: aiConfigured ? "var(--status-approved)" : "var(--status-pending)" }}>
              {aiConfigured ? "Ready (BYOK or platform fallback)" : "Not configured — use templates or /admin/ai"}
            </span>
          </p>
          <button
            type="button"
            onClick={next}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={primaryBtnStyle}
          >
            Start
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Organization name</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await adminUpdateOrganizationDisplayName({
                      name: name.trim(),
                    });
                    await mergeOnboardingSteps({ orgProfile: true });
                    next();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Failed");
                  }
                });
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={primaryBtnStyle}
            >
              {pending ? "Saving…" : "Save & continue"}
            </button>
            <button type="button" onClick={next} className="text-sm underline">
              Skip
            </button>
          </div>
          {msg && <p className="text-sm" style={{ color: "var(--status-denied)" }}>{msg}</p>}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Service catalog</h2>
          {existingTypeCount > 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              You already have {existingTypeCount} request type(s). You can skip
              or add more (duplicates by slug will fail).
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="cat"
                checked={catalogMode === "template"}
                onChange={() => setCatalogMode("template")}
              />
              Start from a template
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="cat"
                checked={catalogMode === "ai"}
                onChange={() => setCatalogMode("ai")}
                disabled={!aiConfigured}
              />
              Generate with AI
              {!aiConfigured ? " (configure /admin/ai first)" : null}
            </label>
          </div>
          {catalogMode === "template" && (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            >
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {catalogMode === "ai" && (
            <div className="space-y-2">
              <input
                placeholder="Industry (e.g. fintech, healthcare)"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
              <textarea
                placeholder="Optional notes for the model"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !catalogMode}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    if (catalogMode === "template") {
                      const p = await loadCatalogTemplateAction(templateId);
                      setProposal(p);
                    } else {
                      const { proposal: pr } =
                        await onboardingGenerateCatalogProposal({
                          orgName: name,
                          industry,
                          notes,
                        });
                      setProposal(pr);
                    }
                    next();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Failed");
                  }
                });
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={primaryBtnStyle}
            >
              {pending ? "Working…" : "Build preview"}
            </button>
            <button
              type="button"
              onClick={() => {
                void mergeOnboardingSteps({ catalog: true });
                setStep(4);
              }}
              className="rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: "var(--line)" }}
            >
              Skip catalog (use Admin → Catalog later)
            </button>
          </div>
          {msg && <p className="text-sm" style={{ color: "var(--status-denied)" }}>{msg}</p>}
        </section>
      )}

      {step === 3 && proposal && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Preview catalog</h2>
          <ul className="space-y-2 text-sm">
            {proposal.requestTypes.map((t) => (
              <li
                key={t.slug}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="font-medium">{t.title}</span>{" "}
                <code className="text-xs" style={{ color: "var(--ink-3)" }}>{t.slug}</code>
                <p style={{ color: "var(--ink-2)" }}>
                  {t.description}
                </p>
              </li>
            ))}
          </ul>
          {catalogMode === "ai" && (
            <div className="flex flex-col gap-2">
              <input
                placeholder="Refine (e.g. make titles shorter)"
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={pending || !refinement.trim()}
                onClick={() => {
                  setMsg(null);
                  startTransition(async () => {
                    try {
                      const { proposal: pr } =
                        await onboardingGenerateCatalogProposal({
                          orgName: name,
                          industry,
                          notes,
                          refinement: refinement.trim(),
                        });
                      setProposal(pr);
                      setRefinement("");
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : "Failed");
                    }
                  });
                }}
                className="w-fit rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                style={{ borderColor: "var(--line)" }}
              >
                Regenerate with refinement
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await onboardingApplyCatalogProposal(proposal);
                    setMsg("Catalog applied.");
                    next();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Failed");
                  }
                });
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={primaryBtnStyle}
            >
              {pending ? "Applying…" : "Apply to catalog"}
            </button>
            <button
              type="button"
              onClick={() => {
                void mergeOnboardingSteps({ catalog: true });
                next();
              }}
              className="text-sm underline"
            >
              Skip (already have types)
            </button>
          </div>
          {msg && (
            <p style={{ fontSize: "0.875rem", color: msg.startsWith("Catalog") ? "var(--status-approved)" : "var(--status-denied)" }}>
              {msg}
            </p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Approval routing</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Map request types to approvers under{" "}
            <Link href="/admin/routing" className="underline">
              Admin → Routing
            </Link>
            . Approvers must have the approver or admin role.
          </p>
          <button
            type="button"
            onClick={() => {
              void mergeOnboardingSteps({ routing: true });
              next();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={primaryBtnStyle}
          >
            Mark routing as done
          </button>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Integrations</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Optional outbound webhooks:{" "}
            <Link href="/admin/integrations" className="underline">
              Admin → Integrations
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={() => {
              void mergeOnboardingSteps({ integrations: true });
              next();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={primaryBtnStyle}
          >
            Continue
          </button>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Email</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            For approval emails and invites, set{" "}
            <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
              RESEND_API_KEY
            </code>{" "}
            and{" "}
            <code className="rounded px-1 text-xs" style={{ background: "var(--subtle)" }}>
              EMAIL_FROM
            </code>{" "}
            in your deployment environment. Gmail / Microsoft Graph OAuth can be
            wired later via org email settings.
          </p>
          <button
            type="button"
            onClick={() => {
              void mergeOnboardingSteps({ emailDoc: true });
              next();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={primaryBtnStyle}
          >
            Continue
          </button>
        </section>
      )}

      {step === 7 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Invite a teammate</h2>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(
                  e.target.value as "requester" | "approver" | "admin",
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            >
              <option value="requester">Requester</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendInviteEmail}
                onChange={(e) => setSendInviteEmail(e.target.checked)}
              />
              Send email (requires RESEND_API_KEY)
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !inviteEmail.trim()}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                try {
                  const r = await adminCreateInvite({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    sendEmail: sendInviteEmail,
                  });
                  setInviteUrl(r.signupUrl);
                  void mergeOnboardingSteps({ invites: true });
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Failed");
                }
              });
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={primaryBtnStyle}
          >
            {pending ? "Creating…" : "Create invite link"}
          </button>
          {inviteUrl && (
            <div className="rounded-lg p-3 text-xs" style={{ background: "var(--subtle)" }}>
              <p className="font-medium">Share this link</p>
              <p className="mt-1 break-all" style={{ color: "var(--ink-2)" }}>
                {inviteUrl}
              </p>
            </div>
          )}
          {msg && <p className="text-sm" style={{ color: "var(--status-denied)" }}>{msg}</p>}
          <button type="button" onClick={next} className="block text-sm underline">
            Skip
          </button>
        </section>
      )}

      {step === 8 && (
        <section className="space-y-4 rounded-lg border p-6" style={sectionStyle}>
          <h2 className="font-medium">Finish</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            You can reopen this wizard anytime from the home copilot or{" "}
            <Link href="/onboarding?force=1" className="underline">
              /onboarding?force=1
            </Link>
            .
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await markOnboardingComplete();
                router.push("/");
                router.refresh();
              });
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={primaryBtnStyle}
          >
            {pending ? "Saving…" : "Go to home"}
          </button>
        </section>
      )}

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="text-sm underline"
          style={{ color: "var(--ink-3)" }}
        >
          Back
        </button>
      )}
    </div>
  );
}
