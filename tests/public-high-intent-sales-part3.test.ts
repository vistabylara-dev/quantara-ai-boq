import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicCapability } from "@/lib/public-site/product-truth";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const targetPages = [
  "src/app/(marketing)/boq-software-uae/page.tsx",
  "src/app/(marketing)/boq-software-dubai/page.tsx",
  "src/app/(marketing)/construction-estimating-software-uae/page.tsx",
  "src/app/(marketing)/mep-estimating-software-uae/page.tsx",
  "src/app/(marketing)/boq-software-for-contractors/page.tsx",
  "src/app/(marketing)/boq-software-for-quantity-surveyors/page.tsx",
  "src/app/(marketing)/boq-software-for-mep-contractors/page.tsx",
  "src/app/(marketing)/boq-software-for-fit-out-companies/page.tsx",
] as const;

const buyerJourney = read(
  "src/components/marketing/public-buyer-journey.tsx",
);
const regionalLanding = read(
  "src/components/layout/regional-landing-page.tsx",
);
const industryLanding = read(
  "src/components/layout/industry-landing-page.tsx",
);
const seoLanding = read(
  "src/components/layout/seo-landing-page.tsx",
);
const llms = read("public/llms.txt");

describe("Part 3 high-intent buyer journeys", () => {
  it("opts exactly the intended eight page sources into the buyer journey", () => {
    for (const page of targetPages) {
      expect(read(page), page).toContain("showBuyerJourney: true");
    }

    expect(targetPages).toHaveLength(8);
  });

  it("renders the opt-in block in all three public landing architectures", () => {
    for (const source of [regionalLanding, industryLanding, seoLanding]) {
      expect(source).toContain("PublicBuyerJourney");
      expect(source).toContain("content.showBuyerJourney");
      expect(source).toContain('t("publicContent.cta.startAccountSetup")');
    }
  });

  it("uses the bilingual sales truth and safe public conversion links", () => {
    expect(buyerJourney).toContain("getPublicSalesTruth(locale)");
    expect(buyerJourney).toContain('href="/register"');
    expect(buyerJourney).toContain('href="/features"');
    expect(buyerJourney).toContain('href="/tayqan-ai-quantity-surveyor"');
    expect(buyerJourney).toContain('href="/pricing"');

    expect(buyerJourney).not.toContain("/api/commerce/checkout");
    expect(buyerJourney).not.toContain("/api/tayqan/checkout");
    expect(buyerJourney).not.toMatch(/guaranteed (?:accuracy|speed)/i);
  });

  it("keeps the current measurement and Autodesk capability truth intact", () => {
    expect(getPublicCapability("visible-calculations").status).toBe("AVAILABLE");
    expect(getPublicCapability("autodesk-dwg-analysis").status).toBe(
      "CONTROLLED_ACCESS",
    );
    expect(getPublicCapability("automatic-drawing-takeoff").status).toBe(
      "NOT_AVAILABLE",
    );
    expect(getPublicCapability("scanned-pdf-ocr").status).toBe(
      "NOT_AVAILABLE",
    );
  });

  it("publishes all eight buyer pages in llms.txt with explicit claim boundaries", () => {
    for (const path of [
      "/boq-software-uae",
      "/boq-software-dubai",
      "/construction-estimating-software-uae",
      "/mep-estimating-software-uae",
      "/boq-software-for-contractors",
      "/boq-software-for-quantity-surveyors",
      "/boq-software-for-mep-contractors",
      "/boq-software-for-fit-out-companies",
    ]) {
      expect(llms).toContain(`https://quantara.vistabylara.com${path}`);
    }

    expect(llms).toContain("automatic arbitrary drawing takeoff");
    expect(llms).toContain("OCR extraction");
    expect(llms).toContain("guaranteed professional accuracy");
  });
});