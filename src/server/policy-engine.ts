import { randomUUID } from "crypto";
import { db } from "@/db";
import { policyDecisionLog } from "@/db/schema";
import { PolicyDeniedError } from "@/lib/errors";

type PolicyInput = {
  organizationId: string;
  requestTypeSlug: string;
  payload: Record<string, unknown>;
};

function policyFailOpenEnabled(): boolean {
  const mode = process.env.POLICY_ENGINE_FAIL_MODE?.trim().toLowerCase();
  if (mode === "closed") return false;
  if (mode === "open") {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[policy-engine] WARNING: POLICY_ENGINE_FAIL_MODE=open in production — policy failures will allow requests through. This should only be used during planned maintenance.",
      );
    }
    return true;
  }
  return process.env.NODE_ENV !== "production";
}


/**
 * Optional HTTP policy adapter (OPA / OpenFGA-style sidecar, custom service).
 * POST JSON body; expect 200 + `{ "decision": "allow" | "deny", "reason"?: string }`.
 * On network errors or invalid response, defaults to fail-open in non-production
 * and fail-closed in production unless POLICY_ENGINE_FAIL_MODE overrides.
 */
export async function evaluatePolicyOrThrow(input: PolicyInput) {
  const url = process.env.POLICY_ENGINE_URL?.trim();
  if (!url) return;

  const timeoutMs = Math.max(
    500,
    Math.min(30_000, Number(process.env.POLICY_ENGINE_TIMEOUT_MS) || 8_000),
  );
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        organizationId: input.organizationId,
        requestTypeSlug: input.requestTypeSlug,
        payload: input.payload,
      }),
    });
    if (!res.ok) {
      if (!policyFailOpenEnabled()) {
        throw new PolicyDeniedError("Policy engine unavailable.");
      }
      return;
    }
    const json = (await res.json()) as {
      decision?: string;
      reason?: string;
      version?: string;
    };
    
    // Log the policy decision
    await db.insert(policyDecisionLog).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      requestTypeSlug: input.requestTypeSlug,
      decision: json.decision ?? "unknown",
      reason: json.reason ?? null,
      policyVersion: json.version ?? null,
    });

    if (json.decision === "deny") {
      throw new PolicyDeniedError(json.reason);
    }
  } catch (e) {
    if (e instanceof PolicyDeniedError) throw e;
    console.warn("[policy-engine] evaluation skipped or failed:", e);
    if (!policyFailOpenEnabled()) {
      throw new PolicyDeniedError("Policy engine evaluation failed.");
    }
  } finally {
    clearTimeout(t);
  }
}
