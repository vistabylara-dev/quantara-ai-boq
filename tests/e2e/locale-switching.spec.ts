import { test, expect, type Page } from "@playwright/test";

/**
 * ARABIC-RTL-LOCALIZATION — TEST 2: locale switching. Proves the language
 * switcher preserves the current route and auth session — it only writes a
 * cookie and calls router.refresh() (see locale-provider.tsx), never a
 * route change or full reload/logout.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
}

test.describe("ARABIC-RTL-LOCALIZATION — language switcher preserves route, project, and session", () => {
  test("English to Arabic and back, on the same route, without logout", async ({ page, context }) => {
    test.setTimeout(60_000);
    await context.clearCookies();
    await login(page);

    // ---- Starts English (default locale) ----
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({ timeout: 20_000 });

    const urlBeforeSwitch = page.url();

    // ---- Switch to Arabic ----
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Same route — never navigated away.
    expect(page.url()).toBe(urlBeforeSwitch);
    // Never logged out — still on the authenticated dashboard, not redirected to /login.
    expect(page.url()).toContain("/dashboard");

    // Real Arabic UI text is now visible (sidebar navigation label).
    await expect(page.getByRole("link", { name: "لوحة التحكم" })).toBeVisible({ timeout: 20_000 });

    // ---- Switch back to English ----
    await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    expect(page.url()).toBe(urlBeforeSwitch);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("persists the language choice across a hard navigation (cookie-backed)", async ({ page, context }) => {
    test.setTimeout(60_000);
    await context.clearCookies();
    await login(page);

    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 20_000 });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
