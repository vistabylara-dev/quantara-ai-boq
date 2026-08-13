import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";
import { PUBLIC_WEBSITE_PATHS } from "@/lib/public-site/public-route-paths";
import {
  PUBLIC_SEARCH_PAGES,
  PUBLIC_SITE_ORIGIN,
  createPublicPageMetadata,
  createPrivateUtilityMetadata,
  createPublicUtilityMetadata,
} from "@/lib/public-site/search-registry";

const repoRoot = process.cwd();
const marketingRoot = join(repoRoot, "src", "app", "(marketing)");

function findPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return findPageFiles(entryPath);
    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function routeForPage(filePath: string): string {
  const pageDirectory = relative(marketingRoot, dirname(filePath));
  return pageDirectory === "" ? "/" : `/${pageDirectory.split(sep).join("/")}`;
}

const registeredPaths = PUBLIC_SEARCH_PAGES.map((entry) => entry.path);
const indexableEntries = PUBLIC_SEARCH_PAGES.filter((entry) => entry.indexable !== false);

describe("public search registry", () => {
  it("keeps the metadata-free client shell routes aligned with the registry", () => {
    expect([...PUBLIC_WEBSITE_PATHS].sort()).toEqual([...registeredPaths].sort());
  });

  it("covers every static marketing page except the noindex registration utility", () => {
    const filesystemRoutes = findPageFiles(marketingRoot)
      .map(routeForPage)
      .filter((route) => !route.includes("["))
      .filter((route) => route !== "/register")
      .sort();

    expect([...registeredPaths].sort()).toEqual(filesystemRoutes);
    expect(registeredPaths).not.toContain("/industries/[industryId]");
  });

  it("has unique, concise titles and descriptions for every registered route", () => {
    expect(new Set(registeredPaths).size).toBe(registeredPaths.length);
    expect(new Set(PUBLIC_SEARCH_PAGES.map((entry) => entry.title)).size).toBe(PUBLIC_SEARCH_PAGES.length);
    expect(new Set(PUBLIC_SEARCH_PAGES.map((entry) => entry.description)).size).toBe(PUBLIC_SEARCH_PAGES.length);

    for (const entry of PUBLIC_SEARCH_PAGES) {
      expect(entry.title.trim().length, `${entry.path} title`).toBeGreaterThan(0);
      expect(entry.title.length, `${entry.path} title`).toBeLessThanOrEqual(60);
      expect(entry.description.trim().length, `${entry.path} description`).toBeGreaterThan(0);
      expect(entry.description.length, `${entry.path} description`).toBeLessThanOrEqual(155);
    }
  });

  it("keeps the four owner-confirmation-dependent legal documents out of the public search index", () => {
    expect(indexableEntries).toHaveLength(58);
    expect(
      PUBLIC_SEARCH_PAGES
        .filter((entry) => entry.indexable === false)
        .map((entry) => entry.path)
        .sort(),
    ).toEqual([
      "/acceptable-use",
      "/cookie-policy",
      "/data-processing",
      "/subprocessors",
    ]);
  });

  it("builds self-consistent canonical and social metadata from one source", () => {
    for (const entry of PUBLIC_SEARCH_PAGES) {
      const metadata = createPublicPageMetadata(entry.path);
      const canonicalUrl = `${PUBLIC_SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`;

      expect(metadata.title).toEqual({ absolute: entry.title });
      expect(metadata.description).toBe(entry.description);
      expect(metadata.alternates).toEqual({
        canonical: canonicalUrl,
        languages: { "en-AE": canonicalUrl },
      });
      expect(metadata.robots).toMatchObject({
        index: entry.indexable !== false,
        follow: entry.indexable !== false,
      });
      expect(metadata.openGraph).toMatchObject({
        title: entry.title,
        description: entry.description,
        url: canonicalUrl,
        siteName: "Quantara",
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary_large_image",
        title: entry.title,
        description: entry.description,
      });
    }
  });

  it("generates the sitemap from indexable registry entries only", () => {
    const sitemapUrls = sitemap().map((entry) => entry.url).sort();
    const expectedUrls = indexableEntries
      .map((entry) => `${PUBLIC_SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`)
      .sort();

    expect(sitemapUrls).toEqual(expectedUrls);
    expect(sitemapUrls).not.toContain(`${PUBLIC_SITE_ORIGIN}/login`);
    expect(sitemapUrls).not.toContain(`${PUBLIC_SITE_ORIGIN}/register`);
  });

  it("provides centralized page schema for every indexable public route", () => {
    const schemaMarkers = [
      "PublicJsonLd",
      "PublicPageJsonLd",
      "LegalPolicyPage",
      "SeoLandingPage",
      "KnowledgePage",
      "IndustryLandingPage",
      "RegionalLandingPage",
      "ComparisonPage",
    ];

    for (const entry of indexableEntries) {
      const pageFile = entry.path === "/"
        ? join(marketingRoot, "page.tsx")
        : join(marketingRoot, ...entry.path.slice(1).split("/"), "page.tsx");
      const pageSource = readFileSync(pageFile, "utf8");
      const layoutSource = entry.path === "/contact-sales"
        ? readFileSync(join(dirname(pageFile), "layout.tsx"), "utf8")
        : "";

      expect(
        schemaMarkers.some((marker) => pageSource.includes(marker) || layoutSource.includes(marker)),
        `${entry.path} missing centralized page schema`,
      ).toBe(true);
    }
  });

  it("keeps every registered content route public in the middleware boundary", () => {
    const middlewareSource = readFileSync(join(repoRoot, "src", "middleware.ts"), "utf8");

    expect(middlewareSource).toContain("PUBLIC_WEBSITE_PATHS");

    for (const utilityPath of [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/llms.txt",
    ]) {
      expect(middlewareSource, `middleware missing ${utilityPath}`).toContain(
        JSON.stringify(utilityPath),
      );
    }
  });

  it("serves representative signed-out marketing routes and protects application routes", () => {
    for (const path of [
      "/",
      "/features",
      "/pricing",
      "/ai-boq-software",
      "/boq-software",
      "/pdf-boq-extraction",
      "/scanned-pdf-boq",
      "/boq-software-uae",
      "/boq-software-dubai",
      "/what-is-a-boq",
    ]) {
      const response = middleware(new NextRequest(`${PUBLIC_SITE_ORIGIN}${path}`));
      expect(response.headers.get("location"), `${path} redirected`).toBeNull();
      expect(response.headers.get("x-middleware-next"), `${path} did not continue`).toBe("1");
    }

    const protectedResponse = middleware(new NextRequest(`${PUBLIC_SITE_ORIGIN}/dashboard`));
    expect(protectedResponse.status).toBe(307);
    expect(protectedResponse.headers.get("location")).toBe(
      `${PUBLIC_SITE_ORIGIN}/login?next=%2Fdashboard`,
    );
  });

  it("publishes a truthful AI-readable llms.txt discovery file", () => {
    const llms = readFileSync(join(repoRoot, "public", "llms.txt"), "utf8");

    expect(llms).toMatch(/^# Quantara/m);
    expect(llms).toContain("https://quantara.vistabylara.com/features");
    expect(llms).toContain("https://quantara.vistabylara.com/site-map");
    expect(llms).toContain("does not claim automatic drawing measurement");
  });

  it("lets public metadata and AI-discovery files bypass authentication middleware", () => {
    const middlewareSource = readFileSync(join(repoRoot, "src", "middleware.ts"), "utf8");

    for (const publicFile of ["llms.txt", "opengraph-image", "twitter-image"]) {
      expect(middlewareSource).toContain(publicFile);
    }
  });

  it("crawl-blocks protected application and token-sharing prefixes", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(false);
    const disallow = (rules as { disallow?: string[] }).disallow ?? [];

    expect(disallow).toEqual(expect.arrayContaining([
      "/admin",
      "/api",
      "/catalogue",
      "/clients",
      "/dashboard",
      "/integrations",
      "/projects",
      "/proposal",
      "/technical-report",
    ]));
  });

  it("marks authentication and recovery pages as noindex utilities", () => {
    const utilityMetadata = createPublicUtilityMetadata(
      "/login",
      "Sign In to Quantara",
      "Sign in to an existing Quantara workspace.",
    );

    expect(utilityMetadata.robots).toEqual({ index: false, follow: false, noarchive: true });
    expect(utilityMetadata.alternates).toEqual({
      canonical: `${PUBLIC_SITE_ORIGIN}/login`,
      languages: { "en-AE": `${PUBLIC_SITE_ORIGIN}/login` },
    });

    for (const layoutPath of [
      "src/app/login/layout.tsx",
      "src/app/(marketing)/register/layout.tsx",
      "src/app/forgot-password/layout.tsx",
      "src/app/reset-password/layout.tsx",
      "src/app/verify-email/layout.tsx",
    ]) {
      expect(readFileSync(join(repoRoot, layoutPath), "utf8"), layoutPath).toContain(
        "createPublicUtilityMetadata",
      );
    }
  });

  it("marks private share and administration utilities as noindex without a public canonical", () => {
    expect(createPrivateUtilityMetadata("Private", "Private utility.")).toMatchObject({
      robots: { index: false, follow: false, noarchive: true },
      referrer: "no-referrer",
    });
    expect(createPrivateUtilityMetadata("Private", "Private utility.").alternates).toEqual({
      canonical: null,
    });

    for (const layoutPath of [
      "src/app/proposal/layout.tsx",
      "src/app/technical-report/layout.tsx",
      "src/app/admin/login/layout.tsx",
    ]) {
      expect(readFileSync(join(repoRoot, layoutPath), "utf8"), layoutPath).toContain(
        "createPrivateUtilityMetadata",
      );
    }
  });

  it("keeps public marketing and authenticated application shell ownership separate", () => {
    const conditionalShell = readFileSync(
      join(repoRoot, "src", "components", "layout", "conditional-app-shell.tsx"),
      "utf8",
    );
    const marketingLayout = readFileSync(join(marketingRoot, "layout.tsx"), "utf8");

    expect(conditionalShell).toContain("PUBLIC_WEBSITE_PATHS");
    expect(conditionalShell).toContain("PUBLIC_SHELL_ROUTES.has");
    expect(marketingLayout).toContain("PublicHeader");
    expect(marketingLayout).toContain("PublicFooter");
    expect(marketingLayout).not.toContain("AppShell");
    expect(existsSync(join(marketingRoot, "industries", "[industryId]", "page.tsx"))).toBe(false);
    expect(existsSync(join(repoRoot, "src", "app", "industry-engines", "[industryId]", "page.tsx"))).toBe(true);
  });

  it("documents every indexable route in both required website reports", () => {
    const auditPath = join(repoRoot, "docs", "public-seo-geo-aeo-audit.md");
    const intentPath = join(repoRoot, "docs", "public-search-intent-map.md");
    expect(existsSync(auditPath)).toBe(true);
    expect(existsSync(intentPath)).toBe(true);

    const audit = readFileSync(auditPath, "utf8");
    const intent = readFileSync(intentPath, "utf8");
    for (const entry of indexableEntries) {
      expect(audit, `audit report missing ${entry.path}`).toContain(`| \`${entry.path}\` |`);
      expect(intent, `intent report missing ${entry.path}`).toContain(`| \`${entry.path}\` |`);
    }
  });
});
