import type { ProvisionConnector } from "./types";

/**
 * Selects provision implementation. Priority:
 * 1. Explicit connectorId from request type (per-type routing)
 * 2. PROVISION_CONNECTOR env (global fallback)
 * 3. "stub" (dev default)
 */
export function getConnector(connectorId?: string | null): ProvisionConnector {
  const name = connectorId?.trim() || process.env.PROVISION_CONNECTOR?.trim() || "stub";

  if (name === "http_webhook") {
    return {
      name: "http_webhook",
      async provision(ctx) {
        const { runHttpWebhookProvision } = await import("./http-webhook");
        await runHttpWebhookProvision(ctx);
      },
      async revoke(ctx) {
        const { runHttpWebhookRevoke } = await import("./http-webhook");
        await runHttpWebhookRevoke(ctx);
      },
    };
  }

  if (name === "manual_ticketing") {
    return {
      name: "manual_ticketing",
      async provision(ctx) {
        const { runManualProvisionFallback } = await import("./manual-ticketing");
        await runManualProvisionFallback(ctx);
      },
      async revoke(ctx) {
        const { runManualRevokeFallback } = await import("./manual-ticketing");
        await runManualRevokeFallback(ctx);
      },
    };
  }

  if (name === "github") {
    return {
      name: "github",
      async provision(ctx) {
        const { runGitHubProvision } = await import("./github");
        await runGitHubProvision(ctx);
      },
      async revoke(ctx) {
        const { runGitHubRevoke } = await import("./github");
        await runGitHubRevoke(ctx);
      },
    };
  }

  if (name === "google_workspace") {
    return {
      name: "google_workspace",
      async provision(ctx) {
        const { runGoogleWorkspaceProvision } = await import("./google-workspace");
        await runGoogleWorkspaceProvision(ctx);
      },
      async revoke(ctx) {
        const { runGoogleWorkspaceRevoke } = await import("./google-workspace");
        await runGoogleWorkspaceRevoke(ctx);
      },
    };
  }

  if (name === "aws") {
    return {
      name: "aws",
      async provision(ctx) {
        const { runAwsProvision } = await import("./aws");
        await runAwsProvision(ctx);
      },
      async revoke(ctx) {
        const { runAwsRevoke } = await import("./aws");
        await runAwsRevoke(ctx);
      },
    };
  }

  if (name === "slack") {
    return {
      name: "slack",
      async provision(ctx) {
        const { runSlackProvision } = await import("./slack");
        await runSlackProvision(ctx);
      },
      async revoke(ctx) {
        const { runSlackRevoke } = await import("./slack");
        await runSlackRevoke(ctx);
      },
    };
  }

  if (name === "linear") {
    return {
      name: "linear",
      async provision(ctx) {
        const { runLinearProvision } = await import("./linear");
        await runLinearProvision(ctx);
      },
      async revoke(ctx) {
        const { runLinearRevoke } = await import("./linear");
        await runLinearRevoke(ctx);
      },
    };
  }

  if (name === "vercel") {
    return {
      name: "vercel",
      async provision(ctx) {
        const { runVercelProvision } = await import("./vercel");
        await runVercelProvision(ctx);
      },
      async revoke(ctx) {
        const { runVercelRevoke } = await import("./vercel");
        await runVercelRevoke(ctx);
      },
    };
  }

  if (name === "openai") {
    return {
      name: "openai",
      async provision(ctx) {
        const { runOpenAIProvision } = await import("./openai");
        await runOpenAIProvision(ctx);
      },
      async revoke(ctx) {
        const { runOpenAIRevoke } = await import("./openai");
        await runOpenAIRevoke(ctx);
      },
    };
  }

  if (name === "notion") {
    return {
      name: "notion",
      async provision(ctx) {
        const { runNotionProvision } = await import("./notion");
        await runNotionProvision(ctx);
      },
      async revoke(ctx) {
        const { runNotionRevoke } = await import("./notion");
        await runNotionRevoke(ctx);
      },
    };
  }

  if (name === "stripe") {
    return {
      name: "stripe",
      async provision(ctx) {
        const { runStripeProvision } = await import("./stripe");
        await runStripeProvision(ctx);
      },
      async revoke(ctx) {
        const { runStripeRevoke } = await import("./stripe");
        await runStripeRevoke(ctx);
      },
    };
  }

  if (name === "log") {
    return {
      name: "log",
      async provision(ctx) {
        console.info("[connector:log] provision", ctx);
        const { runProvisionStub } = await import("@/server/fulfillment");
        await runProvisionStub(ctx);
      },
      async revoke(ctx) {
        console.info("[connector:log] revoke", ctx);
        const { runRevokeStub } = await import("@/server/fulfillment");
        await runRevokeStub(ctx);
      },
    };
  }

  return {
    name: "stub",
    async provision(ctx) {
      const { runProvisionStub } = await import("@/server/fulfillment");
      await runProvisionStub(ctx);
    },
    async revoke(ctx) {
      const { runRevokeStub } = await import("@/server/fulfillment");
      await runRevokeStub(ctx);
    },
  };
}
