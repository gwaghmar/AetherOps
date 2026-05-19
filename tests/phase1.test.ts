/**
 * Phase 1 — ensureUserProfileAction unit tests
 *
 * Verifies that when DEFAULT_ORGANIZATION_ID is set and the org row is missing,
 * db.insert is called twice: once for the org and once for the user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- module mocks (must be hoisted above imports) ---

vi.mock("@/db/schema", () => ({
  user: { id: "id", email: "email", name: "name" },
  organization: { id: "id", name: "name", slug: "slug" },
}));

vi.mock("drizzle-orm", () => ({
  count: vi.fn(() => ({ as: "count_star" })),
  eq: vi.fn((_col: unknown, _val: unknown) => "eq_condition"),
}));

// db mock — all methods are set up per-test via helpers below
vi.mock("@/db", () => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: insertValues }));

  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where, limit }));
  const select = vi.fn(() => ({ from }));

  return { db: { select, insert, _insertValues: insertValues } };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

// --- import after mocks are registered ---
import { db } from "@/db";
import { ensureUserProfileAction } from "@/app/actions/auth";
import { createServerClient } from "@/lib/supabase/server";

// ---- helpers ----

/**
 * Make db.select().from().where().limit() return the given rows for every call in sequence.
 *
 * The `from()` return value needs to satisfy two usage patterns:
 *   a) `await db.select().from(t)` — destructured directly (count query)
 *   b) `await db.select().from(t).where(...).limit(1)` — chained (existence checks)
 *
 * We accomplish this by making each `from()` call return a custom thenable/iterable
 * that also exposes `.where()` and `.limit()`.
 */
function mockSelectSequence(...results: unknown[][]) {
  let call = 0;

  function makeChain() {
    const rows = results[call++] ?? [];

    // A thenable that also acts as an iterable and exposes .where()/.limit()
    const chain: {
      then: (resolve: (v: unknown) => void) => void;
      [Symbol.iterator]: () => Iterator<unknown>;
      where: (cond: unknown) => typeof chain;
      limit: (n: number) => typeof chain;
    } = {
      then(resolve) {
        resolve(rows);
      },
      [Symbol.iterator]() {
        return rows[Symbol.iterator]();
      },
      where(_cond: unknown) {
        return this;
      },
      limit(_n: number) {
        return this;
      },
    };

    return chain;
  }

  const from = vi.fn().mockImplementation(() => makeChain());
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from };
}

/** Make createServerClient return a fake Supabase client */
function mockSupabase(userId: string, email: string) {
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email } },
      }),
    },
  });
}

// ---- tests ----

describe("ensureUserProfileAction — org auto-creation", () => {
  beforeEach(() => {
    vi.stubEnv("DEFAULT_ORGANIZATION_ID", "org_demo");
    vi.stubEnv("DEFAULT_ORGANIZATION_SLUG", "");
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("inserts org row then user row when both are missing (first sign-up)", async () => {
    mockSupabase("user-abc", "alice@example.com");

    // Call sequence:
    // 1. check existing user   → [] (not found)
    // 2. check existing org    → [] (not found)
    // 3. count users           → [{ n: 0 }]  (first user → admin)
    mockSelectSequence([], [], [{ n: 0 }]);

    const result = await ensureUserProfileAction("Alice");

    expect(result.ok).toBe(true);

    // db.insert must have been called exactly twice
    expect(db.insert).toHaveBeenCalledTimes(2);

    // First insert — org
    const orgTable = (await import("@/db/schema")).organization;
    expect(db.insert).toHaveBeenNthCalledWith(1, orgTable);

    // Second insert — user
    const userTable = (await import("@/db/schema")).user;
    expect(db.insert).toHaveBeenNthCalledWith(2, userTable);

    // Org values: slug derived from orgId, name falls back to "AetherOps"
    const insertValues = (db as unknown as { _insertValues: ReturnType<typeof vi.fn> })._insertValues;
    const firstCall = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.id).toBe("org_demo");
    expect(firstCall.name).toBe("AetherOps");
    expect(firstCall.slug).toBe("demo"); // "org_demo".replace(/^org_/, "").toLowerCase()

    // User values: first sign-up → role must be "admin"
    const secondCall = insertValues.mock.calls[1][0] as Record<string, unknown>;
    expect(secondCall.role).toBe("admin");
  });

  it("skips org insert when org row already exists", async () => {
    mockSupabase("user-xyz", "bob@example.com");

    // 1. check user     → [] (new user)
    // 2. check org      → [{ id: "org_demo" }]  (already exists)
    // 3. count users    → [{ n: 5 }]
    mockSelectSequence([], [{ id: "org_demo" }], [{ n: 5 }]);

    const result = await ensureUserProfileAction("Bob");

    expect(result.ok).toBe(true);

    // Only one insert — for the user (org skipped)
    expect(db.insert).toHaveBeenCalledTimes(1);
    const userTable = (await import("@/db/schema")).user;
    expect(db.insert).toHaveBeenCalledWith(userTable);
  });

  it("skips org insert entirely when DEFAULT_ORGANIZATION_ID is unset", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DEFAULT_ORGANIZATION_ID", "");

    mockSupabase("user-noo", "charlie@example.com");

    // 1. check user → []
    // 2. count users → [{ n: 1 }]
    mockSelectSequence([], [{ n: 1 }]);

    const result = await ensureUserProfileAction("Charlie");

    expect(result.ok).toBe(true);

    // Only user insert — no org attempted
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("returns ok:false when not authenticated", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const result = await ensureUserProfileAction("Ghost");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Not authenticated");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("uses NEXT_PUBLIC_APP_NAME as org name when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "MyOps Platform");
    mockSupabase("user-abc2", "dev@example.com");
    mockSelectSequence([], [], [{ n: 0 }]);

    await ensureUserProfileAction("Dev");

    const insertValues = (db as unknown as { _insertValues: ReturnType<typeof vi.fn> })._insertValues;
    const firstCall = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.name).toBe("MyOps Platform");
  });

  it("uses DEFAULT_ORGANIZATION_SLUG when set instead of deriving from orgId", async () => {
    vi.stubEnv("DEFAULT_ORGANIZATION_SLUG", "custom-slug");
    mockSupabase("user-abc3", "ops@example.com");
    mockSelectSequence([], [], [{ n: 0 }]);

    await ensureUserProfileAction("Ops");

    const insertValues = (db as unknown as { _insertValues: ReturnType<typeof vi.fn> })._insertValues;
    const firstCall = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.slug).toBe("custom-slug");
  });
});
