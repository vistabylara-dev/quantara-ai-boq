import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";
import { PROVIDER_REGISTRY } from "@/lib/integrations/provider-registry";
import {
  PUBLIC_INTEGRATION_IDS,
  PUBLIC_INTEGRATION_PATHS,
} from "@/lib/public-site/public-integration-ids";
import {
  PUBLIC_SEARCH_PAGES,
  PUBLIC_SITE_ORIGIN,
} from "@/lib/public-site/search-registry";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const featuresSource = read("src/app/(marketing)/features/page.tsx");
const hubSource = read("src/app/(marketing)/boq-integrations/page.tsx");
const detailSource = read(
  "src/app/(marketing)/boq-integrations/[providerId]/page.tsx",
);
const navigationSource = read("src/config/public-navigation.ts");
const llms = read("public/llms.txt");

describe("Part 3A Features and integration discovery", () => {
  it("publishes the exact integration registry as 43 public routes", () => {
    expect(PUBLIC_INTEGRATION_IDS).toHaveLength(43);
    expect([...PUBLIC_INTEGRATION_IDS].sort()).toEqual(
      PROVIDER_REGISTRY.map((provider) => provider.id).sort(),
    );
    expect(PUBLIC_INTEGRATION_PATHS).toHaveLength(43);
  });

  it("makes the hub and every integration detail URL public and indexable", () => {
    const hub = PUBLIC_SEARCH_PAGES.find(
      (entry) => entry.path === "/boq-integrations",
    );

    expect(hub).toBeDefined();
    expect(hub?.intent).toBe("commercial");
    expect(hub?.indexable).not.toBe(false);

    const sitemapUrls = new Set(sitemap().map((entry) => entry.url));

    for (const routePath of PUBLIC_INTEGRATION_PATHS) {
      expect(
        sitemapUrls.has(`${PUBLIC_SITE_ORIGIN}${routePath}`),
        routePath,
      ).toBe(true);

      const response = middleware(
        new NextRequest(`${PUBLIC_SITE_ORIGIN}${routePath}`),
      );

      expect(response.headers.get("location"), `${routePath} redirected`).toBeNull();
      expect(
        response.headers.get("x-middleware-next"),
        `${routePath} did not continue`,
      ).toBe("1");
    }
  });

  it("publishes capability truth separately from integration discovery", () => {
    expect(featuresSource).toContain("getPublicFeatureSales(locale)");
    expect(featuresSource).toContain("featureSales.groups");
    expect(featuresSource).toContain("PROVIDER_REGISTRY.length");
    expect(featuresSource).toContain('href="/boq-integrations"');

    for (const marker of [
      "statusPresentation",
      "getPublicCapabilityStatusForDisplay",
      "capabilityStatus",
      "NOT_AVAILABLE",
      "CONTROLLED_ACCESS",
      "PUBLIC_CAPABILITY_REVIEW_DATE",
    ]) {
      expect(featuresSource).toContain(marker);
    }

    expect(featuresSource).not.toContain("provider.status");
  });

  it("keeps public integration presentation free of availability badges", () => {
    expect(hubSource).toContain("PROVIDER_REGISTRY");
    expect(detailSource).toContain("PROVIDER_REGISTRY");
    expect(detailSource).toContain("generateStaticParams");
    expect(detailSource).toContain("generateMetadata");
    expect(detailSource).toContain("buildPublicPageGraph");

    for (const source of [hubSource, detailSource]) {
      expect(source).not.toContain("provider.status");
      expect(source).not.toContain("COMING_SOON");
      expect(source).not.toContain("BETA");
      expect(source).not.toContain("REQUIRES_PLUGIN");
      expect(source).not.toContain("FILE_IMPORT_ONLY");
    }
  });

  it("publishes integration discovery without checkout or backend calls", () => {
    for (const source of [featuresSource, hubSource, detailSource]) {
      expect(source).not.toContain("/api/");
      expect(source).not.toContain("/api/commerce/checkout");
      expect(source).not.toContain("/api/tayqan/checkout");
    }

    expect(detailSource).toContain('href="/register"');
    expect(detailSource).toContain('href="/features"');
    expect(detailSource).toContain('href="/tayqan-ai-quantity-surveyor"');
  });

  it("removes integration status from public navigation", () => {
    expect(navigationSource).toContain('href: "/boq-integrations"');
    expect(navigationSource).toContain('href: "/boq-integrations/autodesk"');
    expect(navigationSource).toContain('href: "/boq-integrations/revit"');
    expect(navigationSource).toContain('href: "/boq-integrations/procore"');
    expect(navigationSource).toContain('href: "/boq-integrations/costx"');
    expect(navigationSource).not.toContain("googleDriveImport.status");
    expect(navigationSource).not.toContain("clear status labels");
  });

  it("makes all integration brands AI-readable from llms.txt", () => {
    for (const provider of PROVIDER_REGISTRY) {
      expect(llms, provider.displayName).toContain(provider.displayName);
    }

    expect(llms).toContain(
      "https://quantara.vistabylara.com/boq-integrations",
    );
  });
});
