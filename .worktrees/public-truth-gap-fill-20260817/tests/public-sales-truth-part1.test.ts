import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const homepage = read("src/app/(marketing)/page.tsx");
const features = read("src/app/(marketing)/features/page.tsx");
const pricing = read("src/app/(marketing)/pricing/page.tsx");
const salesTruth = read("src/lib/public-site/sales-truth.ts");
const llms = read("public/llms.txt");
const publicPart1 = [homepage, features, pricing, salesTruth, llms].join("\n");

describe("public sales truth part 1", () => {
  it("leads with the current outcome and surfaces AI Draft BOQ plus TAYQAN", () => {
    expect(salesTruth).toContain("From Project Files to a Reviewable BOQ — Faster");
    expect(salesTruth).toContain("AI Draft BOQ");
    expect(salesTruth).toContain("TAYQAN — AI Quantity Surveyor");
    expect(homepage).toContain("sales.heroTitle");
    expect(homepage).toContain("sales.aiDraftTitle");
    expect(homepage).toContain("sales.tayqanTitle");
    expect(features).toContain("sales.aiDraftBullets");
    expect(features).toContain("sales.tayqanBullets");
  });

  it("keeps the owner-approved core public subscription prices unchanged", () => {
    expect(pricing).toContain('monthly: { amount: "AED 149", priceCode: "starter_monthly_aed_149" }');
    expect(pricing).toContain('monthly: { amount: "AED 399", priceCode: "professional_monthly_aed_399" }');
    expect(pricing).toContain('monthly: { amount: "AED 899", priceCode: "business_monthly_aed_899" }');
    expect(pricing).toContain('annual: { amount: "AED 1,490", priceCode: "starter_annual_aed_1490" }');
    expect(pricing).toContain('annual: { amount: "AED 3,990", priceCode: "professional_annual_aed_3990" }');
    expect(pricing).toContain('annual: { amount: "AED 8,990", priceCode: "business_annual_aed_8990" }');
    expect(homepage).not.toContain('t("publicContent.home.commercialFaq")');
    expect(salesTruth).toContain("Quantara publishes Starter, Professional and Business subscriptions");
  });

  it("renders TAYQAN prices from the existing commerce truth without new public checkout code", () => {
    const byPlan = new Map(TAYQAN_HIRE_PLANS.map((plan) => [plan.plan, plan]));

    expect(byPlan.get("DAY")?.amountMinor).toBe(29_900);
    expect(byPlan.get("DAY")?.maxDistinctProjects).toBe(2);
    expect(byPlan.get("WEEK")?.amountMinor).toBe(99_900);
    expect(byPlan.get("MONTHLY")?.amountMinor).toBe(249_900);
    expect(pricing).toContain("TAYQAN_HIRE_PLANS.map");
    expect(pricing).not.toContain("/api/commerce/checkout");
    expect(pricing).not.toContain("tayqan_day_299");
    expect(pricing).not.toContain("tayqan_week_999");
    expect(pricing).not.toContain("tayqan_monthly_2499");
  });

  it("keeps professional responsibility and unsupported capability boundaries explicit", () => {
    expect(llms).toContain("does not currently perform OCR text extraction");
    expect(llms).toContain(
      "does not make a blanket claim of fully unattended computer-vision takeoff",
    );
    expect(llms).toContain("does not automatically approve, issue, lock, tender-submit or certify");
    expect(llms).toContain("Final professional acceptance remains under human control");
    // Boundary copy may truthfully say that accuracy/speed are NOT guaranteed.
    // Reject only affirmative guarantee claims.
    expect(publicPart1).not.toMatch(
      /\b(?:Quantara|TAYQAN|we|our)\b[^.\n]{0,120}\b(?:guarantees?|guaranteed)\b[^.\n]{0,80}\b(?:accuracy|speed)\b/i,
    );
    expect(publicPart1).not.toMatch(
      /\b(?:accuracy|speed)\b[^.\n]{0,40}\bis guaranteed\b/i,
    );
    expect(publicPart1).not.toMatch(/\b24\s*\/\s*7 support\b/i);
  });

  it("gives AI systems current pricing and product answers without claiming indexing guarantees", () => {
    expect(llms).toContain("Starter: AED 149 per month or AED 1,490 per year");
    expect(llms).toContain("Professional: AED 399 per month or AED 3,990 per year");
    expect(llms).toContain("Business: AED 899 per month or AED 8,990 per year");
    expect(llms).toContain("TAYQAN Day: AED 299");
    expect(llms).toContain("TAYQAN Week: AED 999");
    expect(llms).toContain("TAYQAN Monthly / Digital QS: AED 2,499");
    expect(llms).not.toMatch(/llms\.txt[^.\n]{0,100}(guarantees|guaranteed) (AI )?index/i);
  });
});