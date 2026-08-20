import type { PrismaClient } from "@prisma/client";

/**
 * MARKETPLACE-FULL-STRIPE-LINK — one-time, idempotent backfill closing two
 * layers of the marketplace pricing bug: real prices for the 15 existing
 * library IndustryDataPackage rows (Layer 1 — createOrReuseDatasetPackage
 * hardcodes monthlyPrice/annualPrice: 0 at creation with no way to change
 * them later), and review approval for exactly the 30 CommercePrice rows
 * seedCommerceProducts derives from them once INDUSTRY_ACCESS_CANDIDATES is
 * fixed (Layer 4 — CommercePrice.reviewStatus defaults to REQUIRES_REVIEW
 * and classifyPriceEligibility hard-blocks anything not APPROVED from ever
 * reaching a Stripe sync plan). Mirrors the upsert-by-stable-key convention
 * already used by seedCommerceProducts/seedSoftwarePlans/seedMechanicalPackage
 * — safe to run repeatedly, never insert-only, never a wildcard update.
 *
 * Ordering matters and is enforced by the caller (prisma/seed.ts), not by
 * this file:
 *   1. backfillLibraryPackagePricing() must run BEFORE seedCommerceProducts()
 *      — it reads pkg.monthlyPrice/annualPrice to derive each
 *      CommercePrice.amountMinor (Math.round(Number(pkg.monthlyPrice) * 100)).
 *   2. approveLibraryPackagePrices() must run AFTER seedCommerceProducts()
 *      — it looks up the 30 CommercePrice rows that function creates, by
 *      their exact deterministic code (industry_<key>_monthly / _annual),
 *      and approves only those exact rows — never a broad
 *      WHERE reviewStatus = 'REQUIRES_REVIEW' update.
 *
 * Never touches mechanical-hvac-professional (a separate pilot package, see
 * commerce-products.ts's own note on INDUSTRY_ACCESS_CANDIDATES) or any
 * Starter/Professional/Business/Enterprise/TAYQAN/AI-credit-pack product or
 * price — this file only ever reads/writes the 15 keys listed below.
 */

export type LibraryPackagePriceSpec = {
  key: string;
  name: string;
  /** AED, whole units — matches IndustryDataPackage.monthlyPrice/annualPrice's shape. */
  monthlyPrice: number;
  annualPrice: number;
};

/** Verified against src/config/libraries.ts's CATALOGUE_LIBRARIES — every
 *  key here must resolve to a real IndustryDataPackage.key. Values are the
 *  product owner's confirmed price table; never round, recompute, or invent. */
export const LIBRARY_PACKAGE_PRICES: LibraryPackagePriceSpec[] = [
  { key: "architectural-finishes-library", name: "Architectural Finishes Library", monthlyPrice: 100, annualPrice: 1000 },
  { key: "bim-digital-deliverables-library", name: "BIM & Digital Deliverables Library", monthlyPrice: 150, annualPrice: 1500 },
  { key: "civil-works-library", name: "Civil Works Library", monthlyPrice: 200, annualPrice: 2000 },
  { key: "closeout-library", name: "Closeout Library", monthlyPrice: 50, annualPrice: 500 },
  { key: "doors-and-windows-library", name: "Doors and Windows Library", monthlyPrice: 120, annualPrice: 1200 },
  { key: "facade-library", name: "Facade Library", monthlyPrice: 180, annualPrice: 1800 },
  { key: "general-requirements-library", name: "General Requirements Library", monthlyPrice: 80, annualPrice: 800 },
  { key: "hvac-library", name: "HVAC Library", monthlyPrice: 250, annualPrice: 2500 },
  { key: "landscaping-library", name: "Landscaping Library", monthlyPrice: 110, annualPrice: 1100 },
  { key: "plumbing-library", name: "Plumbing Library", monthlyPrice: 130, annualPrice: 1300 },
  { key: "roofing-library", name: "Roofing Library", monthlyPrice: 90, annualPrice: 900 },
  { key: "site-infrastructure-library", name: "Site Infrastructure Library", monthlyPrice: 160, annualPrice: 1600 },
  { key: "structural-library", name: "Structural Library", monthlyPrice: 170, annualPrice: 1700 },
  { key: "temporary-works-library", name: "Temporary Works Library", monthlyPrice: 70, annualPrice: 700 },
  { key: "uae-authority-regulatory-library", name: "UAE Authority & Regulatory Library", monthlyPrice: 90, annualPrice: 900 },
];

export type LibraryPricingBackfillReport = {
  updated: string[];
  unchanged: string[];
  /** A key from LIBRARY_PACKAGE_PRICES with no backing IndustryDataPackage row — never fabricated. */
  missing: string[];
};

export async function backfillLibraryPackagePricing(prisma: PrismaClient): Promise<LibraryPricingBackfillReport> {
  const report: LibraryPricingBackfillReport = { updated: [], unchanged: [], missing: [] };

  for (const spec of LIBRARY_PACKAGE_PRICES) {
    const pkg = await prisma.industryDataPackage.findUnique({ where: { key: spec.key } });
    if (!pkg) {
      report.missing.push(spec.key);
      continue;
    }

    const alreadyCorrect =
      Number(pkg.monthlyPrice) === spec.monthlyPrice &&
      Number(pkg.annualPrice) === spec.annualPrice &&
      pkg.currency === "AED";
    if (alreadyCorrect) {
      report.unchanged.push(spec.key);
      continue;
    }

    await prisma.industryDataPackage.update({
      where: { id: pkg.id },
      data: { monthlyPrice: spec.monthlyPrice, annualPrice: spec.annualPrice, currency: "AED" },
    });
    report.updated.push(spec.key);
  }

  return report;
}

export type LibraryPriceApprovalReport = {
  /** CommercePrice.code values just moved from REQUIRES_REVIEW to APPROVED. */
  approved: string[];
  alreadyApproved: string[];
  /** A price code that doesn't exist yet — seedCommerceProducts hasn't run, or the backing package is missing. */
  missing: string[];
};

const APPROVAL_NOTE = "Approved via library-package-pricing backfill — prices confirmed by product owner.";

/** Every CommercePrice.code this backfill is allowed to touch — nothing outside this exact set. */
function libraryPriceCodes(): string[] {
  return LIBRARY_PACKAGE_PRICES.flatMap((spec) => {
    const stem = `industry_${spec.key.replace(/-/g, "_")}`;
    return [`${stem}_monthly`, `${stem}_annual`];
  });
}

export async function approveLibraryPackagePrices(prisma: PrismaClient): Promise<LibraryPriceApprovalReport> {
  const report: LibraryPriceApprovalReport = { approved: [], alreadyApproved: [], missing: [] };

  for (const code of libraryPriceCodes()) {
    const price = await prisma.commercePrice.findUnique({ where: { code } });
    if (!price) {
      report.missing.push(code);
      continue;
    }
    if (price.reviewStatus === "APPROVED") {
      report.alreadyApproved.push(code);
      continue;
    }

    // reviewedByUserId is deliberately left untouched (stays null) — this is
    // a scripted data step, not an individual admin action; the column is
    // nullable for exactly this reason.
    await prisma.commercePrice.update({
      where: { id: price.id },
      data: { reviewStatus: "APPROVED", reviewedAt: new Date(), reviewNote: APPROVAL_NOTE },
    });
    report.approved.push(code);
  }

  return report;
}
