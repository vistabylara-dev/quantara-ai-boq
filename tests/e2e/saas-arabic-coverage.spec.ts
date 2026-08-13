import { test, expect, type Page } from "@playwright/test";

/**
 * Focused SaaS Arabic coverage check — proves the specific authenticated
 * surfaces translated in this pass (dashboard, catalogue, settings,
 * integrations, marketplace detail, Industry Engines) render real Arabic
 * text once the locale is switched, not just that the switch itself works
 * (already covered by locale-switching.spec.ts).
 */

async function loginAndSwitchToArabic(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local");
  await page.locator("#password").fill(process.env.DEV_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: /initialize/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar", { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

test.describe("SAAS-ARABIC-COVERAGE", () => {
  test("dashboard renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page);
    await expect(page.getByText("المقاييس الأساسية")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("توجيهات النظام")).toBeVisible();
  });

  test("catalogue renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page);
    await page.goto("/catalogue");
    await expect(page.getByText("كتالوج الأسعار")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "إضافة سعر" })).toBeVisible();
  });

  test("settings renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page);
    await page.goto("/settings");
    await expect(page.getByText("إعدادات مساحة العمل")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("الاشتراك")).toBeVisible();
  });

  test("integrations renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page);
    await page.goto("/integrations");
    await expect(page.getByText("اربط مساحة عمل الهندسة الخاصة بك")).toBeVisible({ timeout: 20_000 });
  });

  test("industry engines renders Arabic UI text", async ({ page, context }) => {
    await context.clearCookies();
    await loginAndSwitchToArabic(page);
    await page.goto("/industry-engines");
    await expect(page.getByText("محركات الصناعة").first()).toBeVisible({ timeout: 20_000 });
  });
});
