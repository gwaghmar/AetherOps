import { expect, test } from "@playwright/test";

test.describe("Authz on dashboard routes", () => {
  test("requester is redirected from /approvals and /admin/types to /", async ({
    page,
  }) => {

    const ts = Date.now();
    const email = `authz-req-${ts}@example.com`;
    const password = "authz-e2e-pass-ok-99!!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Authz Requester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });

    await page.goto("/approvals");
    await page.waitForURL(
      (url) => new URL(url).pathname === "/",
      { timeout: 15_000 },
    );

    await page.goto("/admin/types");
    await page.waitForURL(
      (url) => new URL(url).pathname === "/",
      { timeout: 15_000 },
    );
    await expect(
      page.getByRole("heading", { name: "Request catalog" }),
    ).toHaveCount(0);

    const audit = await page.request.get(
      "/api/admin/audit-export?from=2024-01-01&to=2024-01-07",
    );
    expect(audit.status()).toBe(403);
    const pdf = await page.request.get(
      "/api/admin/audit-pdf?from=2024-01-01&to=2024-01-07",
    );
    expect(pdf.status()).toBe(403);
  });

  test("approver can open /approvals but not /admin/types", async ({
    page,
  }) => {

    const ts = Date.now();
    const email = `authz-appr-${ts}@example.com`;
    const password = "authz-e2e-pass-ok-99!!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Authz Approver");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });

    const { setUserRole } = await import("./helpers/pg");
    await setUserRole(email, "approver");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByRole("link", { name: "Approvals" })).toBeVisible();

    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/admin/types");
    await page.waitForURL(
      (url) => new URL(url).pathname === "/",
      { timeout: 15_000 },
    );
  });
});
