import { expect, test } from "@playwright/test";

test.describe("Dashboard after sign-up", () => {
  test("reaches home; admin nav only when first user in DB", async ({ page }) => {

    const ts = Date.now();
    const email = `admin-smoke-${ts}@example.com`;
    const password = "admin-smoke-pass-ok-99!!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Admin Smoke");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });

    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    const roleBadge = page
      .locator("header")
      .locator("span")
      .filter({ hasText: /^(admin|approver|requester)$/ });
    await expect(roleBadge).toBeVisible();
    const role = (await roleBadge.textContent())?.trim() ?? "";
    if (role === "admin") {
      await expect(page.getByRole("link", { name: "Catalog" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
      await expect(page.getByRole("link", { name: "API keys" })).toBeVisible();
    }
  });
});
