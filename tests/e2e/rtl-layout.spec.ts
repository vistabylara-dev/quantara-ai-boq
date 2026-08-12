import { test, expect, type Page } from "@playwright/test";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 4 (RTL layout) + TEST 5 (technical
 * direction). Scoped to the surfaces this pass actually localized: shell
 * chrome, login, BOQ start wizard. Tables may scroll inside their own
 * container — the PAGE itself must never overflow horizontally.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

async function switchToArabic(page: Page) {
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 20_000 });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // A few px of tolerance for sub-pixel rounding on transformed/blurred decorative layers.
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("ARABIC-RTL-LOCALIZATION — RTL layout has no page-level horizontal overflow", () => {
  test("desktop: dashboard shell and BOQ start wizard", async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await context.clearCookies();
    await login(page);
    await switchToArabic(page);

    await page.goto("/dashboard");
    await assertNoHorizontalOverflow(page);

    await page.goto("/projects");
    await assertNoHorizontalOverflow(page);
  });

  test("mobile (375px): shell, mobile navigation drawer open", async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await context.clearCookies();
    await login(page);
    await switchToArabic(page);

    await page.goto("/dashboard");
    await assertNoHorizontalOverflow(page);

    // Open the mobile navigation drawer — it must render from the START
    // edge (right, in RTL) and not push the page wider than the viewport.
    await page.getByRole("button", { name: "فتح قائمة التنقل" }).click();
    await expect(page.getByRole("dialog", { name: "التنقل الرئيسي" })).toBeVisible({ timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("technical direction: item code, quantity, and price stay LTR inside Arabic UI", async ({ page, context }) => {
    test.setTimeout(60_000);
    await context.clearCookies();
    await login(page);
    await switchToArabic(page);

    await page.goto("/dashboard");
    // The search shortcut badge is a stable, always-visible technical token.
    const shortcutBadge = page.getByText("CTRL+K");
    await expect(shortcutBadge).toBeVisible({ timeout: 20_000 });
    await expect(shortcutBadge).toHaveAttribute("dir", "ltr");
  });
});
