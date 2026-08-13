import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import ar from "../../src/lib/i18n/dictionaries/ar";

async function useArabic(context: BrowserContext) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "quantara_locale",
      value: "ar",
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

async function expectArabicRtlPage(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(2);
}

test.describe("approved Arabic public-page correction", () => {
  test.beforeEach(async ({ context }) => {
    await useArabic(context);
  });

  test("Homepage renders localized body content in RTL", async ({ page }) => {
    await page.goto("/");
    await expectArabicRtlPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ar.publicContent.home.pageTitle,
    );
    await expect(page.getByRole("heading", { name: ar.publicContent.home.workflowTitle })).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.capabilities.textPdfExtraction.name)).toBeVisible();
    await expect(page.getByText("AI-Assisted BOQ Workflow Software for UAE Construction Teams")).toHaveCount(0);
    await expect(page.getByText("From Project Sources to Professional Outputs")).toHaveCount(0);
  });

  test("Features renders localized capability and status content in RTL", async ({ page }) => {
    await page.goto("/features");
    await expectArabicRtlPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ar.publicContent.features.pageTitle,
    );
    await expect(page.getByRole("heading", { name: ar.publicContent.features.registerTitle })).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.status.unavailableLabel).first()).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.capabilities.automaticDrawingTakeoff.name)).toBeVisible();
    await expect(page.getByText("Verified Public Capability Register")).toHaveCount(0);
    await expect(page.getByText("Boundary:")).toHaveCount(0);
  });

  test("Contact Sales renders localized form content while retaining canonical values", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "English server failure" }),
      }),
    );
    await page.goto("/contact-sales");
    await expectArabicRtlPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ar.publicContent.contactSales.pageTitle,
    );
    await expect(page.getByRole("heading", { name: ar.publicContent.contactSales.formTitle })).toBeVisible();
    await expect(page.getByLabel(ar.publicContent.contactSales.fullName)).toBeVisible();
    await expect(page.getByLabel(ar.publicContent.contactSales.companyType)).toHaveValue(
      "Main Contractor",
    );
    await expect(
      page.getByLabel(ar.publicContent.contactSales.companyType).locator("option").first(),
    ).toHaveText(ar.publicContent.contactSales.mainContractor);
    const pageBody = page.locator("main");
    await expect(pageBody.getByText("Contact Sales", { exact: true })).toHaveCount(0);
    await expect(pageBody.getByText("Talk to an Expert", { exact: true })).toHaveCount(0);

    const requiredTextboxes = page.locator("form input[required]:not([type=checkbox]), form textarea[required]");
    for (let index = 0; index < (await requiredTextboxes.count()); index += 1) {
      const field = requiredTextboxes.nth(index);
      await field.fill((await field.getAttribute("type")) === "email" ? "arabic@example.com" : "بيانات اختبار");
    }
    await page.getByLabel(ar.publicContent.contactSales.consent).check();
    await page.getByRole("button", { name: ar.publicContent.contactSales.submit }).click();
    await expect(page.locator("form [role=alert]")).toHaveText(ar.publicContent.contactSales.error);
    await expect(page.getByText("English server failure")).toHaveCount(0);
  });
});
