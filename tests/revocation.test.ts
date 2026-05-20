import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the db module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    query: {
      request: {
        findMany: vi.fn(),
      },
    },
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return cb(tx);
    }),
  },
}));

vi.mock("@/server/fulfillment-queue", () => ({
  enqueueFulfillmentJob: vi.fn(),
}));

vi.mock("@/server/audit", () => ({
  recordAuditEvent: vi.fn(),
}));

import { db } from "@/db";
import { scanAndEnqueueRevocations, scanAndNotifyExpiring } from "@/server/revocation";
import { enqueueFulfillmentJob } from "@/server/fulfillment-queue";

// Helper to mock db.select().from().where()
function mockDbSelect(returnValue: Record<string, unknown>[]) {
  const where = vi.fn().mockResolvedValue(returnValue);
  const from = vi.fn().mockReturnValue({ where });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

// Helper to mock db.query.request.findMany()
function mockDbQueryFindMany(returnValue: Record<string, unknown>[]) {
  (db as unknown as { query: { request: { findMany: ReturnType<typeof vi.fn> } } })
    .query.request.findMany.mockResolvedValue(returnValue);
}

describe("Revocation Worker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("scanAndEnqueueRevocations", () => {
    it("does nothing when no requests are expired", async () => {
      mockDbSelect([]);
      
      const result = await scanAndEnqueueRevocations();
      expect(result.enqueued).toBe(0);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("enqueues revocation jobs for expired requests", async () => {
      const mockReq = {
        id: "req_expire_1",
        organizationId: "org_1",
        expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
      };
      mockDbSelect([mockReq]);
      
      const result = await scanAndEnqueueRevocations();
      
      expect(result.enqueued).toBe(1);
      expect(db.transaction).toHaveBeenCalledTimes(1);
      
      // Since the tx callback is invoked by our mock, we check if the inner functions were called
      expect(enqueueFulfillmentJob).toHaveBeenCalledWith(
        {
          organizationId: "org_1",
          requestId: "req_expire_1",
          actorId: null,
          jobType: "revoke",
        },
        expect.anything()
      );
    });
  });

  describe("scanAndNotifyExpiring", () => {
    it("does nothing when no requests are expiring soon", async () => {
      mockDbQueryFindMany([]);

      const result = await scanAndNotifyExpiring();
      expect(result.notified).toBe(0);
    });

    it("notifies for requests expiring soon", async () => {
      const where = vi.fn().mockResolvedValue(undefined);
      const set = vi.fn().mockReturnValue({ where });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set });

      const mockReq = {
        id: "req_notify_1",
        organizationId: "org_1",
        expiresAt: new Date(Date.now() + 3600000), // Expiring in 1 hour
        requester: { email: "user@example.com", name: "User" },
        requestType: { title: "Slack Access" },
      };
      mockDbQueryFindMany([mockReq]);

      const result = await scanAndNotifyExpiring();

      expect(result.notified).toBe(1);
      expect(db.update).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith(expect.objectContaining({
        preExpiryNotifiedAt: expect.any(Date),
      }));
      expect(where).toHaveBeenCalled();
    });
  });
});
