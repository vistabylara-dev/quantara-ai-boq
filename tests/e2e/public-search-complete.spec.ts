import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { PROVIDER_REGISTRY } from "../../src/lib/integrations/provider-registry";
import { PUBLIC_INTEGRATION_PATHS } from "../../src/lib/public-site/public-integration-ids";
import {
  PUBLIC_SEARCH_PAGES,
  PUBLIC_SITE_ORIGIN,
  type PublicSearchPage,
} from "../../src/lib/public-site/search-registry";

const PUBLIC_ROUTE_CASES: readonly Pick<
  PublicSearchPage,
  "path" | "title" | "description" | "indexable"
>[] = [
  ...PUBLIC_SEARCH_PAGES,
  ...PUBLIC_INTEGRATION_PATHS.map((path) => {
    const providerId = path.slice("/boq-integrations/".length);
    const provider = PROVIDER_REGISTRY.find((candidate) => candidate.id === providerId);
    if (!provider) throw new Error(`Missing public integration provider: ${providerId}`);

    return {
      path,
      title: `${provider.displayName} Integration with Quantara`,
      description: `Explore how ${provider.displayName} fits into Quantara project-source, BOQ, measurement, review and Digital QS workflows.`,
      indexable: true,
    };
  }),
];

const DARK_THEME_ROUTES = [
  "/comparisons",
  "/boq-software-comparison-uae",
  "/what-is-a-boq",
  "/boq-software-uae",
  "/boq-software-for-contractors",
  "/features",
  "/pricing",
  "/about",
] as const;

function runOnlyInDesktopChromium(projectName: string) {
  test.skip(
    projectName !== "chromium",
    "The complete public-route audit runs once in desktop Chromium to keep runtime controlled.",
  );
}

test.describe("complete public search-route validation", () => {
  test.describe.configure({ mode: "serial" });

  test("every registered route is search-complete and readable", async ({ context, page }, testInfo) => {
    runOnlyInDesktopChromium(testInfo.project.name);
    test.setTimeout(900_000);
    await context.clearCookies();

    for (const route of PUBLIC_ROUTE_CASES) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const canonicalPath = route.path === "/" ? "" : route.path;
      const expectedCanonical = `${PUBLIC_SITE_ORIGIN}${canonicalPath}`;

      expect.soft(response?.status(), `${route.path}: HTTP status`).toBe(200);
      expect.soft(new URL(page.url()).pathname, `${route.path}: final pathname`).toBe(route.path);

      const audit = await page.evaluate(() => {
        const isVisible = (element: Element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number.parseFloat(style.opacity || "1") > 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const marketingWrappers = Array.from(
          document.querySelectorAll('div[data-theme="dark"]'),
        ).filter((element) => element.querySelector("main#main-content"));
        const documentElement = document.documentElement;
        const body = document.body;

        return {
          title: document.title,
          description: document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content"),
          canonical: document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute("href"),
          robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
          visibleH1Count: Array.from(document.querySelectorAll("h1")).filter(isVisible).length,
          jsonLd: Array.from(
            document.querySelectorAll('script[type="application/ld+json"]'),
          ).map((script) => script.textContent ?? ""),
          marketingWrapperCount: marketingWrappers.length,
          marketingWrapperVisible:
            marketingWrappers.length === 1 && isVisible(marketingWrappers[0]),
          documentLanguage: documentElement.lang,
          documentDirection: documentElement.dir,
          horizontalOverflow: Math.max(
            documentElement.scrollWidth - documentElement.clientWidth,
            body.scrollWidth - documentElement.clientWidth,
          ),
        };
      });

      expect.soft(audit.title, `${route.path}: title`).toBe(route.title);
      expect.soft(audit.description, `${route.path}: meta description`).toBe(route.description);
      expect.soft(audit.canonical, `${route.path}: canonical`).toBe(expectedCanonical);

      const robotTokens = new Set(
        (audit.robots ?? "")
          .toLowerCase()
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean),
      );
      if (route.indexable === false) {
        expect.soft(robotTokens.has("noindex"), `${route.path}: robots noindex`).toBe(true);
        expect.soft(robotTokens.has("nofollow"), `${route.path}: robots nofollow`).toBe(true);
      } else {
        expect.soft(robotTokens.has("index"), `${route.path}: robots index`).toBe(true);
        expect.soft(robotTokens.has("follow"), `${route.path}: robots follow`).toBe(true);
        expect.soft(audit.visibleH1Count, `${route.path}: visible H1 count`).toBe(1);
      }

      expect.soft(audit.jsonLd.length, `${route.path}: JSON-LD blocks`).toBeGreaterThan(0);
      for (const [index, schema] of audit.jsonLd.entries()) {
        expect.soft(
          () => JSON.parse(schema),
          `${route.path}: JSON-LD block ${index + 1} parses`,
        ).not.toThrow();
      }

      expect.soft(audit.marketingWrapperCount, `${route.path}: marketing wrapper count`).toBe(1);
      expect.soft(audit.marketingWrapperVisible, `${route.path}: marketing wrapper visibility`).toBe(true);
      expect.soft(audit.documentLanguage, `${route.path}: document language`).toBe("en-AE");
      expect.soft(audit.documentDirection, `${route.path}: document direction`).toBe("ltr");
      expect.soft(audit.horizontalOverflow, `${route.path}: horizontal overflow in pixels`).toBeLessThanOrEqual(2);
    }
  });

  test("representative public routes pass dark-theme accessibility checks", async ({ context, page }, testInfo) => {
    runOnlyInDesktopChromium(testInfo.project.name);
    test.setTimeout(180_000);
    await context.clearCookies();
    await page.addInitScript(() => {
      window.localStorage.setItem("quantara-theme-mode", "dark");
    });

    for (const path of DARK_THEME_ROUTES) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status(), `${path}: HTTP status`).toBe(200);
      await expect(page.locator("html"), `${path}: root dark theme`).toHaveAttribute(
        "data-theme",
        "dark",
      );

      const marketingWrapper = page
        .locator('div[data-theme="dark"]')
        .filter({ has: page.locator("main#main-content") });
      await expect(marketingWrapper, `${path}: dark marketing wrapper`).toHaveCount(1);
      await expect(marketingWrapper, `${path}: visible dark marketing wrapper`).toBeVisible();

      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(
        accessibility.violations,
        `${path}: axe violations (${accessibility.violations
          .map((violation) => violation.id)
          .join(", ")})`,
      ).toEqual([]);
    }
  });

  test("an Arabic app preference does not mislabel the English marketing document", async ({ context, page }, testInfo) => {
    runOnlyInDesktopChromium(testInfo.project.name);
    await context.clearCookies();
    await context.addCookies([
      {
        name: "quantara_locale",
        value: "ar",
        url: "http://localhost:3000",
      },
    ]);

    const response = await page.goto("/boq-software-comparison-uae", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-AE");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.locator('div[data-theme="dark"]').filter({ has: page.locator("main#main-content") }),
    ).toHaveCount(1);
  });

  test("phone-width priority routes and navigation remain readable", async ({ context, page }, testInfo) => {
    runOnlyInDesktopChromium(testInfo.project.name);
    test.setTimeout(180_000);
    await context.clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [
      "/",
      "/boq-software-comparison-uae",
      "/features",
      "/boq-software-dubai",
      "/about",
    ]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path}: phone-width HTTP status`).toBe(200);
      await expect(page.locator("html"), `${path}: phone-width language`).toHaveAttribute(
        "lang",
        "en-AE",
      );
      await expect(page.locator("html"), `${path}: phone-width direction`).toHaveAttribute(
        "dir",
        "ltr",
      );
      await expect(page.locator("h1"), `${path}: phone-width H1`).toHaveCount(1);

      const overflow = await page.evaluate(() =>
        Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.documentElement.clientWidth,
        ),
      );
      expect(overflow, `${path}: phone-width horizontal overflow`).toBeLessThanOrEqual(2);

      if (["/", "/boq-software-comparison-uae", "/features"].includes(path)) {
        const fileName = path === "/" ? "home-mobile.png" : `${path.slice(1)}-mobile.png`;
        await page.screenshot({ path: testInfo.outputPath(fileName), fullPage: true });
      }
    }

    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator('button[aria-controls="mobile-navigation"]').click();
    await expect(page.locator("#mobile-navigation")).toBeVisible();
    await page.getByRole("button", { name: "Comparisons" }).click();
    await expect(
      page.locator("#mobile-navigation").getByRole("link", { name: "BOQ Software Comparison UAE" }),
    ).toBeVisible();
  });
});
