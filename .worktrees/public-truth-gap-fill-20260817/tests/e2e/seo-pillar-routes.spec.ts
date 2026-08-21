import { expect, test } from "@playwright/test";

const requiredPublicRoutes = [
  { path: "/", h1: "AI-Assisted BOQ Workflow Software for UAE Construction Teams" },
  { path: "/features", h1: "BOQ Workflow Features and Availability" },
  { path: "/pricing", h1: "Quantara Access and Commercial Terms" },
  { path: "/ai-boq-software", h1: "AI BOQ Software for Structured, Human-Reviewed Project Workflows" },
  { path: "/boq-software", h1: "BOQ Software for Controlled Construction and Estimating Workflows" },
  { path: "/pdf-boq-extraction", h1: "AI-Assisted PDF BOQ Extraction with Structured Human Review" },
  { path: "/scanned-pdf-boq", h1: "Scanned & Image-Only PDF BOQ Handling" },
  { path: "/what-is-a-boq", h1: "What Is a BOQ? A Practical Guide to Bills of Quantities" },
  { path: "/boq-software-uae", h1: "BOQ Software for UAE Construction and Estimating Teams" },
  { path: "/boq-software-dubai", h1: "BOQ Software for Dubai Construction Workflows" },
  { path: "/resources", h1: "BOQ Resources & Knowledge Base" },
  { path: "/security", h1: "Security" },
] as const;

test.describe("Quantara public website final audit", () => {
  for (const route of requiredPublicRoutes) {
    test(`${route.path} stays public, isolated and search-complete`, async ({ context, page }) => {
      await context.clearCookies();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(route.path, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(route.path);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(route.h1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();

      for (const appPath of [
        "/dashboard",
        "/projects",
        "/clients",
        "/integrations",
        "/data-library",
        "/marketplace",
        "/imports",
        "/suppliers",
        "/settings",
      ]) {
        await expect(page.locator(`aside a[href="${appPath}"]`)).toHaveCount(0);
      }

      const canonicalPath = route.path === "/" ? "" : route.path;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://quantara.vistabylara.com${canonicalPath}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots ?? "").not.toContain("noindex");

      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(schemas.length).toBeGreaterThan(0);
      for (const schema of schemas) expect(() => JSON.parse(schema)).not.toThrow();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test("navigation, footer, account-setup CTA and theme remain functional", async ({ context, page }, testInfo) => {
    await context.clearCookies();
    await page.goto("/", { waitUntil: "networkidle" });

    if (testInfo.project.name === "Mobile Chrome") {
      await page.getByRole("button", { name: "Open menu" }).click();
      const mobileNavigation = page.getByRole("dialog", { name: "Mobile Navigation" });
      await mobileNavigation.getByRole("button", { name: "Platform", exact: true }).click();
      await mobileNavigation.getByRole("link", { name: /^Features/ }).click();
    } else {
      await page.getByRole("button", { name: "Platform", exact: true }).click();
      await page
        .getByRole("region", { name: "Platform" })
        .getByRole("link", { name: /^Features/ })
        .click();
    }

    await expect(page).toHaveURL(/\/features$/);
    await expect(page.locator("h1")).toHaveText("BOQ Workflow Features and Availability");

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await footer.getByRole("link", { name: /Contact Sales/ }).first().click();
    await expect(page).toHaveURL(/\/contact-sales$/);
    await expect(page.getByLabel("Full name")).toBeVisible();

    await page.goto("/", { waitUntil: "networkidle" });
    if (testInfo.project.name === "Mobile Chrome") {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("dialog", { name: "Mobile Navigation" })
        .getByRole("link", { name: "Start Account Setup", exact: true })
        .click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Start Account Setup", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/register$/);

    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.localStorage.setItem("quantara-theme-mode", "dark"));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const darkBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);

    await page.evaluate(() => window.localStorage.setItem("quantara-theme-mode", "light"));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const lightBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(darkBackground).not.toBe(lightBackground);
  });

  test("dynamic industry workspace remains protected when signed out", async ({ context, page }) => {
    await context.clearCookies();
    const response = await page.goto("/industries/browser-audit", { waitUntil: "domcontentloaded" });

    expect(response?.status()).toBe(200);
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/login");
    expect(finalUrl.searchParams.get("next")).toBe("/industries/browser-audit");
  });
});
