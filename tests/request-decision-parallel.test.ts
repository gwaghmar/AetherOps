import { describe, it, expect, vi, beforeEach } from "vitest";

// We verify the decision logic paths by inspecting what DB operations are attempted.
// Full integration is covered by E2E; here we test the logical branches.

const mockReturning = vi.fn().mockResolvedValue([{ id: "req_1" }]);
const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning, limit: vi.fn().mockResolvedValue([{ id: "req_1" }]) });
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

// Approval count mock: returns count as string (Drizzle sql<string> pattern)
const mockApprovalCountWhere = vi.fn().mockResolvedValue([{ count: "1" }]);
const mockApprovalCountFrom = vi.fn().mockReturnValue({ where: mockApprovalCountWhere });
const mockSelectCount = vi.fn().mockReturnValue({ from: mockApprovalCountFrom });

// Existing-decision check mock: no prior decision by default
const mockExistingDecisionLimit = vi.fn().mockResolvedValue([]);
const mockExistingDecisionWhere = vi.fn().mockReturnValue({ limit: mockExistingDecisionLimit });
const mockExistingDecisionFrom = vi.fn().mockReturnValue({ where: mockExistingDecisionWhere });
const mockSelectExisting = vi.fn().mockReturnValue({ from: mockExistingDecisionFrom });

// Request load mock
const mockRequestLimit = vi.fn().mockResolvedValue([{
  id: "req_1",
  organizationId: "org_1",
  status: "pending_approval",
  routingApproverIds: ["user_a", "user_b"],
  assignedApproverId: "user_a",
}]);
const mockRequestWhere = vi.fn().mockReturnValue({ limit: mockRequestLimit });
const mockRequestFrom = vi.fn().mockReturnValue({ where: mockRequestWhere });
const mockSelectRequest = vi.fn().mockReturnValue({ from: mockRequestFrom });

const mockTx = { insert: mockInsert, update: mockUpdate, select: mockSelectCount };
const mockTransaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

let selectCallCount = 0;
vi.mock("@/db", () => ({
  db: {
    get select() {
      selectCallCount++;
      if (selectCallCount === 1) return mockSelectRequest; // load request
      if (selectCallCount === 2) return mockSelectExisting; // check prior decision
      return mockSelectCount; // approval count inside tx
    },
    transaction: mockTransaction,
  },
}));

vi.mock("@/server/audit", () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/fulfillment-queue", () => ({
  enqueueFulfillmentJob: vi.fn().mockResolvedValue("job_1"),
  processFulfillmentJobById: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/webhooks", () => ({ deliverOrgWebhook: vi.fn() }));
vi.mock("@/server/approval-routing", () => ({
  isApproverAllowedForRequest: vi.fn().mockReturnValue(true),
}));

describe("applyRequestDecision — parallel N-approver model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockRequestLimit.mockResolvedValue([{
      id: "req_1", organizationId: "org_1", status: "pending_approval",
      routingApproverIds: ["user_a", "user_b"], assignedApproverId: "user_a",
    }]);
    mockExistingDecisionLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "req_1" }]);
    mockApprovalCountWhere.mockResolvedValue([{ count: "1" }]);
  });

  it("throws if request not found", async () => {
    mockRequestLimit.mockResolvedValueOnce([]);
    const { applyRequestDecision } = await import("@/server/request-decision");
    await expect(
      applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "approved", actorUserId: "user_a", actorRole: "approver" })
    ).rejects.toThrow("Request not found");
  });

  it("throws if approver already decided", async () => {
    mockExistingDecisionLimit.mockResolvedValueOnce([{ id: "approval_1" }]);
    const { applyRequestDecision } = await import("@/server/request-decision");
    await expect(
      applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "approved", actorUserId: "user_a", actorRole: "approver" })
    ).rejects.toThrow("already decided");
  });

  it("inserts approval row and calls transaction for any decision", async () => {
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "denied", actorUserId: "user_a", actorRole: "approver" });
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it("does not enqueue fulfillment when only 1 of 2 approvers approved", async () => {
    const { enqueueFulfillmentJob } = await import("@/server/fulfillment-queue");
    mockApprovalCountWhere.mockResolvedValueOnce([{ count: "1" }]); // only 1 approved, need 2
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "approved", actorUserId: "user_a", actorRole: "approver" });
    expect(enqueueFulfillmentJob).not.toHaveBeenCalled();
  });

  it("enqueues fulfillment when all approvers have approved (2 of 2)", async () => {
    const { enqueueFulfillmentJob } = await import("@/server/fulfillment-queue");
    mockApprovalCountWhere.mockResolvedValueOnce([{ count: "2" }]); // 2 approved, need 2
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "approved", actorUserId: "user_b", actorRole: "approver" });
    expect(enqueueFulfillmentJob).toHaveBeenCalled();
  });

  it("throws if request is not in an approvable status", async () => {
    mockRequestLimit.mockResolvedValueOnce([{
      id: "req_1", organizationId: "org_1", status: "fulfilled",
      routingApproverIds: ["user_a"], assignedApproverId: "user_a",
    }]);
    const { applyRequestDecision } = await import("@/server/request-decision");
    await expect(
      applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "denied", actorUserId: "user_a", actorRole: "approver" })
    ).rejects.toThrow("Request is not awaiting approval.");
  });

  it("denied path calls transaction and does not enqueue fulfillment", async () => {
    const { enqueueFulfillmentJob } = await import("@/server/fulfillment-queue");
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "denied", actorUserId: "user_a", actorRole: "approver" });
    expect(mockTransaction).toHaveBeenCalled();
    expect(enqueueFulfillmentJob).not.toHaveBeenCalled();
  });

  it("needs_info path calls transaction and does not enqueue fulfillment", async () => {
    const { enqueueFulfillmentJob } = await import("@/server/fulfillment-queue");
    const { applyRequestDecision } = await import("@/server/request-decision");
    await applyRequestDecision({ organizationId: "org_1", requestId: "req_1", decision: "needs_info", actorUserId: "user_a", actorRole: "approver" });
    expect(mockTransaction).toHaveBeenCalled();
    expect(enqueueFulfillmentJob).not.toHaveBeenCalled();
  });
});
