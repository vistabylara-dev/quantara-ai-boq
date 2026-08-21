import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicNavigation, type NavigationItem, type NavigationSection } from "../src/config/public-navigation";
import { getDictionary } from "../src/lib/i18n/dictionaries";
import { createTranslator } from "../src/lib/i18n/translate";

const repoRoot = process.cwd();

function collectItems(sections: NavigationSection[]): NavigationItem[] {
  return sections.flatMap((section) => section.groups.flatMap((group) => group.items));
}

describe("public pricing navigation and authenticated upgrade CTA", () => {
  it("exposes exactly one Pricing → /pricing navigation entry (EN)", () => {
    const en = createTranslator(getDictionary("en"));
    const items = collectItems(getPublicNavigation(en)).filter((item) => item.href === "/pricing");

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Pricing");
  });

  it("resolves the Pricing label to Arabic via the existing translation architecture", () => {
    const ar = createTranslator(getDictionary("ar"));
    const items = collectItems(getPublicNavigation(ar)).filter((item) => item.href === "/pricing");

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("الأسعار");
  });

  it("gives the Pricing navigation item a non-empty localized description covering the plans", () => {
    const en = createTranslator(getDictionary("en"));
    const items = collectItems(getPublicNavigation(en)).filter((item) => item.href === "/pricing");

    expect(items).toHaveLength(1);
    const description = items[0].description ?? "";
    expect(description.trim().length).toBeGreaterThan(0);
    expect(description).toMatch(/Starter/i);
    expect(description).toMatch(/Professional/i);
    expect(description).toMatch(/Business/i);
    expect(description).toMatch(/monthly/i);
    expect(description).toMatch(/annual/i);
    expect(description).toMatch(/AED/i);
  });

  it("routes the authenticated Upgrade CTA to /settings/subscription only", () => {
    const source = readFileSync(join(repoRoot, "src", "components", "layout", "top-header.tsx"), "utf8");

    expect(source).toContain("/settings/subscription");
    expect(source).not.toMatch(/href="\/register"/);
    expect(source).not.toMatch(/href="\/pricing"/);
  });

  it("never calls checkout or carries a price code from the top header", () => {
    const source = readFileSync(join(repoRoot, "src", "components", "layout", "top-header.tsx"), "utf8");

    expect(source).not.toContain("/api/commerce/checkout");
    expect(source).not.toMatch(/priceCode/i);
  });
});
