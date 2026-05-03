// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { TriageBadge } from "@/components/triage-badge";
import { cleanup } from "@testing-library/react";

describe("TriageBadge component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a low risk badge correctly", () => {
    render(<TriageBadge risk="low" />);
    expect(screen.getByText("✦ Low risk")).not.toBeNull();
  });

  it("renders a high risk badge with a reason", () => {
    render(<TriageBadge risk="high" reason="Suspicious activity" />);
    expect(screen.getByText("✦ High risk")).not.toBeNull();
    expect(screen.getByText("Suspicious activity")).not.toBeNull();
  });

  it("returns null for unknown risk levels", () => {
    const { container } = render(<TriageBadge risk="unknown_risk" />);
    expect(container.firstChild).toBeNull();
  });
});
