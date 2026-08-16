import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicNavigation } from "@/config/public-navigation";
import { PUBLIC_WEBSITE_PATHS } from "@/lib/public-site/public-route-paths";
import { PUBLIC_SEARCH_PAGES } from "@/lib/public-site/search-registry";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const pageSource = read(
  "src/app/(marketing)/tayqan-ai-quantity-surveyor/page.tsx",
);
const homepageSource = read("src/app/(marketing)/page.tsx");
const featuresSource = read("src/app/(marketing)/features/page.tsx");
const llms = read("public/llms.txt");

describe("TAYQAN public landing", () => {
  it("is a first-class indexable public search route", () => {
    const route = PUBLIC_SEARCH_PAGES.find(
      (entry) => entry.path === "/tayqan-ai-quantity-surveyor",
    );

    expect(route).toBeDefined();
    expect(route?.cluster).toBe("audience");
    expect(route?.intent).toBe("commercial");
    expect(route?.indexable).not.toBe(false);

    expect(PUBLIC_WEBSITE_PATHS).toContain(
      "/tayqan-ai-quantity-surveyor",
    );

    expect(pageSource).toContain(
      'createPublicPageMetadata("/tayqan-ai-quantity-surveyor")',
    );
    expect(pageSource).toContain("buildPublicPageGraph");
    expect(pageSource).toContain("faqs");
  });

  it("has strong internal and AI discovery", () => {
    const navigationItems = publicNavigation.flatMap((section) =>
      section.groups.flatMap((group) => group.items),
    );

    expect(
      navigationItems.some(
        (item) => item.href === "/tayqan-ai-quantity-surveyor",
      ),
    ).toBe(true);

    expect(homepageSource).toContain(
      'href="/tayqan-ai-quantity-surveyor"',
    );
    expect(featuresSource).toContain(
      'href="/tayqan-ai-quantity-surveyor"',
    );
    expect(llms).toContain(
      "https://quantara.vistabylara.com/tayqan-ai-quantity-surveyor",
    );
  });

  it("uses existing TAYQAN commerce truth without new checkout wiring", () => {
    const plans = new Map(
      TAYQAN_HIRE_PLANS.map((plan) => [plan.plan, plan]),
    );

    expect(plans.get("DAY")?.amountMinor).toBe(29_900);
    expect(plans.get("DAY")?.maxDistinctProjects).toBe(2);
    expect(plans.get("WEEK")?.amountMinor).toBe(99_900);
    expect(plans.get("MONTHLY")?.amountMinor).toBe(249_900);

    expect(pageSource).toContain("TAYQAN_HIRE_PLANS.map");

    expect(pageSource).not.toContain("/api/commerce/checkout");
    expect(pageSource).not.toContain("tayqan_day_299");
    expect(pageSource).not.toContain("tayqan_week_999");
    expect(pageSource).not.toContain("tayqan_monthly_2499");
  });

  it("preserves TAYQAN professional authority boundaries", () => {
    expect(pageSource).toContain(
      "does not automatically approve, issue, lock, certify or tender-submit",
    );

    expect(pageSource).toContain(
      "does not claim fully unattended computer-vision takeoff from arbitrary drawing geometry",
    );

    expect(pageSource).toContain(
      "does not replace the responsible Quantity Surveyor",
    );

    expect(pageSource).toContain(
      "does not invent missing dimensions",
    );

    expect(pageSource).not.toMatch(
      /guaranteed (?:accuracy|speed)/i,
    );
  });

  it("answers the primary AEO questions visibly", () => {
    expect(pageSource).toContain("What is TAYQAN?");
    expect(pageSource).toContain(
      "Does TAYQAN replace a Quantity Surveyor?",
    );
    expect(pageSource).toContain(
      "Can TAYQAN automatically measure any drawing?",
    );
    expect(pageSource).toContain(
      "How much does TAYQAN cost?",
    );
    expect(pageSource).toContain(
      "How do I hire TAYQAN?",
    );
  });
});