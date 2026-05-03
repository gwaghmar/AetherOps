import { describe, expect, it, vi } from "vitest";
import { getConnector } from "@/server/connectors/registry";

describe("Connector Registry", () => {
  it("returns the correct connector by name", async () => {
    const names = ["github", "aws", "slack", "linear", "vercel", "openai", "notion", "stripe"];
    
    for (const name of names) {
      const connector = getConnector(name);
      expect(connector.name).toBe(name);
      expect(typeof connector.provision).toBe("function");
      expect(typeof connector.revoke).toBe("function");
    }
  });

  it("fallbacks to stub for unknown names", () => {
    const connector = getConnector("unknown_service");
    expect(connector.name).toBe("stub");
  });

  it("uses PROVISION_CONNECTOR env if no name provided", () => {
    vi.stubEnv("PROVISION_CONNECTOR", "slack");
    const connector = getConnector(null);
    expect(connector.name).toBe("slack");
    vi.unstubAllEnvs();
  });
});
