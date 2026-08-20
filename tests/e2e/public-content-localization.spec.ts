import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import ar from "../../src/lib/i18n/dictionaries/ar";
import en from "../../src/lib/i18n/dictionaries/en";
import { getPublicFeatureSales } from "../../src/lib/public-site/feature-sales";
import {
  PUBLIC_ENGLISH_ONLY_PATHS,
  PUBLIC_WEBSITE_PATHS,
} from "../../src/lib/public-site/public-route-paths";
import { getPublicSalesTruth } from "../../src/lib/public-site/sales-truth";

const COMPLETED_CORRECTIVE_PATHS = new Set(["/", "/features", "/contact-sales"]);
const ENGLISH_ONLY_PUBLIC_PATHS = new Set<string>(PUBLIC_ENGLISH_ONLY_PATHS);
const PUBLIC_ARABIC_PATHS = [...PUBLIC_WEBSITE_PATHS, "/register"].filter(
  (path) =>
    !COMPLETED_CORRECTIVE_PATHS.has(path) &&
    !ENGLISH_ONLY_PUBLIC_PATHS.has(path),
);

function leafPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

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

  test("Homepage renders localized body content in RTL", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "The completed corrective-page contract is covered once on Chromium.");
    await page.goto("/");
    await expectArabicRtlPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      getPublicSalesTruth("ar").heroTitle,
    );
    await expect(page.getByRole("heading", { name: ar.publicContent.home.workflowTitle })).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.capabilities.textPdfExtraction.name)).toBeVisible();
    await expect(page.getByText("AI-Assisted BOQ Workflow Software for UAE Construction Teams")).toHaveCount(0);
    await expect(page.getByText("From Project Sources to Professional Outputs")).toHaveCount(0);
  });

  test("Features renders localized capability and status content in RTL", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "The completed corrective-page contract is covered once on Chromium.");
    await page.goto("/features");
    await expectArabicRtlPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      getPublicFeatureSales("ar").title,
    );
    await expect(page.getByRole("heading", { name: ar.publicContent.features.registerTitle })).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.status.unavailableLabel).first()).toBeVisible();
    await expect(page.getByText(ar.publicContent.capabilityRegister.capabilities.automaticDrawingTakeoff.name)).toBeVisible();
    await expect(page.getByText("Verified Public Capability Register")).toHaveCount(0);
    await expect(page.getByText("Boundary:")).toHaveCount(0);
  });

  test("Contact Sales renders localized form content while retaining canonical values", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "The completed corrective-page contract is covered once on Chromium.");
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

  test("English and Arabic dictionaries retain exact key parity", () => {
    expect(leafPaths(ar).sort()).toEqual(leafPaths(en).sort());
    for (const [route, payload] of Object.entries(ar.publicRoutes)) {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      expect(Object.keys(parsed), `${route} must provide Arabic content`).not.toHaveLength(0);
    }
  });

  test("untranslated public rewrites stay English and LTR", async ({ page }) => {
    for (const path of PUBLIC_ENGLISH_ONLY_PATHS) {
      await page.goto(path);
      await expect(page.locator("html"), `${path}: language`).toHaveAttribute("lang", "en-AE");
      await expect(page.locator("html"), `${path}: direction`).toHaveAttribute("dir", "ltr");
      const heading = page.locator("h1").first();
      await expect(heading, `${path}: H1`).toBeVisible();
      expect(await heading.innerText(), `${path}: English H1`).not.toMatch(/[\u0600-\u06ff]/);
    }
  });

  test("the complete public route inventory renders Arabic content in RTL", async ({ page }) => {
    // The complete inventory crawl can be first-compile-heavy in local
    // development and slower CI environments. A 900s budget lets the same
    // assertions finish without turning infrastructure latency into a false
    // localization failure.
    test.setTimeout(900_000);
    for (const path of PUBLIC_ARABIC_PATHS) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.ok(), `${path} should load successfully`).toBe(true);
      await expectArabicRtlPage(page);

      const heading = page.locator("h1").first();
      await expect(heading).toBeVisible();
      expect(await heading.innerText(), `${path} needs an Arabic H1`).toMatch(/[\u0600-\u06ff]/);
    }
  });
});
