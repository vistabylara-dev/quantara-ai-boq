import type { PrismaClient } from "@prisma/client";

/**
 * STRIPE-1B — idempotent seed for the internal commerce catalogue
 * (CommerceProduct + CommercePrice + EntitlementTemplate). Mirrors the
 * upsert-by-stable-key pattern already used by seedSoftwarePlans/
 * seedMechanicalPackage in ./commercial.ts — safe to run repeatedly, in
 * dev and in production, never insert-only.
 *
 * Pricing note for the reviewing product owner: `starter_monthly_aed_149`,
 * `professional_monthly_aed_399`, `business_monthly_aed_899`, and
 * `enterprise_installation_from_aed_15000` match the figures already
 * hardcoded in the marketing page and confirmed by the STRIPE-1A audit
 * (docs/stripe-commerce-audit.md §3). The remaining SKU amounts below were
 * filled in to complete the requested product categories (one-time BOQ/
 * report purchases, bundles, tender packages, AI credit packs, add-ons) and
 * have NOT been independently re-confirmed against a pricing document —
 * treat every amountMinor value here as a reviewable default, not a
 * final published price, until the product owner signs off.
 */

export type CommerceSeedReport = {
  productsInserted: number;
  productsUpdated: number;
  productsUnchanged: number;
  pricesInserted: number;
  pricesUnchanged: number;
  pricesArchived: number;
  templatesInserted: number;
  templatesUpdated: number;
  industryProductsCreated: string[];
  industryProductsSkipped: { key: string; reason: string }[];
};

type PriceSpec = {
  code: string;
  amountMinor: number;
  billingInterval: "ONE_TIME" | "MONTH" | "YEAR";
  isFromPrice?: boolean;
};

type EntitlementSpec = {
  maxUsers?: number | null;
  maxWorkspaces?: number | null;
  maxActiveProjects?: number | null;
  maxBoqGenerationsPerMonth?: number | null;
  maxTechnicalReportsPerMonth?: number | null;
  maxWatermarkFreeExportsPerMonth?: number | null;
  permittedExportFormats?: string[];
  removesWatermark?: boolean;
  allowsCompanyBranding?: boolean;
  allowsApiAccess?: boolean;
  allowsWhiteLabel?: boolean;
  industryPackageKeys?: string[];
  aiCreditsGranted?: number | null;
  downloadLimit?: number | null;
  entitlementDurationDays?: number | null;
};

type ProductSpec = {
  code: string;
  type: "SUBSCRIPTION" | "ONE_TIME" | "AI_CREDIT_PACK" | "ADD_ON" | "ENTERPRISE";
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode?: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
  sortOrder: number;
  prices: PriceSpec[];
  entitlement: EntitlementSpec;
};

/** Subscription tiers get a shared duration note: real renewal cadence is
 *  governed by whichever price (monthly/year) was purchased — no purchase
 *  fulfilment path exists yet to consume this, so 30 is an informational
 *  default only (see entitlement-template-service.ts's enforcement map). */
const SUBSCRIPTION_TEMPLATE_DURATION_DAYS = 30;

const CATALOGUE_PRODUCTS: ProductSpec[] = [
  {
    code: "starter",
    type: "SUBSCRIPTION",
    name: "Starter",
    shortDescription: "For a single team getting started with BOQ generation.",
    description: "Entry-level subscription: limited projects, BOQ generations, and watermark-free exports per month.",
    sortOrder: 10,
    prices: [
      { code: "starter_monthly_aed_149", amountMinor: 14900, billingInterval: "MONTH" },
      { code: "starter_annual_aed_1490", amountMinor: 149000, billingInterval: "YEAR" },
    ],
    entitlement: {
      maxUsers: 3,
      maxWorkspaces: 1,
      maxActiveProjects: 3,
      maxBoqGenerationsPerMonth: 10,
      maxTechnicalReportsPerMonth: 5,
      maxWatermarkFreeExportsPerMonth: 5,
      permittedExportFormats: ["PDF"],
      removesWatermark: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  {
    code: "professional",
    type: "SUBSCRIPTION",
    name: "Professional",
    shortDescription: "For growing teams running multiple projects in parallel.",
    description: "Mid-tier subscription: more projects, more monthly generations, company branding on exports.",
    sortOrder: 20,
    prices: [
      { code: "professional_monthly_aed_399", amountMinor: 39900, billingInterval: "MONTH" },
      { code: "professional_annual_aed_3990", amountMinor: 399000, billingInterval: "YEAR" },
    ],
    entitlement: {
      maxUsers: 10,
      maxWorkspaces: 3,
      maxActiveProjects: 15,
      maxBoqGenerationsPerMonth: 50,
      maxTechnicalReportsPerMonth: 25,
      maxWatermarkFreeExportsPerMonth: 25,
      permittedExportFormats: ["PDF", "DOCX", "XLSX"],
      removesWatermark: true,
      allowsCompanyBranding: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  {
    code: "business",
    type: "SUBSCRIPTION",
    name: "Business",
    shortDescription: "For larger teams with high-volume BOQ and reporting needs.",
    description: "Top-tier subscription: unlimited active projects, high monthly generation ceilings, all export formats.",
    sortOrder: 30,
    prices: [
      { code: "business_monthly_aed_899", amountMinor: 89900, billingInterval: "MONTH" },
      { code: "business_annual_aed_8990", amountMinor: 899000, billingInterval: "YEAR" },
    ],
    entitlement: {
      maxUsers: 30,
      maxWorkspaces: 10,
      maxActiveProjects: null,
      maxBoqGenerationsPerMonth: 200,
      maxTechnicalReportsPerMonth: 100,
      maxWatermarkFreeExportsPerMonth: 100,
      permittedExportFormats: ["PDF", "DOCX", "XLSX", "CSV"],
      removesWatermark: true,
      allowsCompanyBranding: true,
      allowsApiAccess: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  /**
   * Enterprise Core/Scale/Authority — annual-prepaid-only SaaS subscriptions
   * (a single YEAR price each, deliberately no MONTH price: unlike
   * starter/professional/business, these are not offered on a monthly
   * cadence). Distinct from the pre-existing `enterprise_installation`
   * below, which is a one-time, CONTACT_SALES professional-services
   * engagement with no SoftwarePlan mapping — these three ARE real
   * `type: "SUBSCRIPTION"` products with real annual CommercePrice rows,
   * mapped to commerce_enterprise_core/scale/authority in
   * src/lib/entitlements/commerce-plan-mapping.ts, but are deliberately
   * `purchaseMode: "DIRECT"` — Enterprise is direct-checkout
   * (see legal.terms.checkoutBody: Enterprise scope requires a separate
   * written quotation/agreement). This keeps them rejected by
   * loadEligibleCommercePrice/PRODUCT_NOT_DIRECT_PURCHASE in
   * commerce-checkout-service.ts and absent from getCheckoutAvailability's
   * DIRECT-only query in commerce-checkout-availability-service.ts, while
   * still allowing a narrow, exact-code LIVE-only sync exception
   * (SALES_LED_LIVE_SYNC_PRODUCT_CODES in stripe-live-sync-service.ts) so an
   * approved price can be created/mapped in live Stripe for a manually
   * issued Stripe Payment Link. The 15 paid Industry Libraries are
   * deliberately NOT included in any of these — that catalogue stays a
   * separate purchase on every tier, same as starter/professional/business
   * above.
   */
  {
    code: "enterprise_core",
    type: "SUBSCRIPTION",
    name: "Enterprise Core",
    shortDescription: "For established contractors and consultancies needing high-volume BOQ production.",
    description:
      "Annual enterprise subscription: high-volume BOQ generation, API enablement subject to configured availability, company branding included as a setup service, and enterprise onboarding.",
    purchaseMode: "DIRECT",
    sortOrder: 34,
    prices: [{ code: "enterprise_core_annual_aed_15000", amountMinor: 1500000, billingInterval: "YEAR" }],
    entitlement: {
      maxUsers: 50,
      maxWorkspaces: 20,
      maxActiveProjects: null,
      maxBoqGenerationsPerMonth: 500,
      maxTechnicalReportsPerMonth: 250,
      maxWatermarkFreeExportsPerMonth: 250,
      permittedExportFormats: ["PDF", "DOCX", "XLSX", "CSV"],
      removesWatermark: true,
      allowsCompanyBranding: true,
      allowsApiAccess: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  {
    code: "enterprise_scale",
    type: "SUBSCRIPTION",
    name: "Enterprise Scale",
    shortDescription: "For multi-team and multi-department companies running BOQ production at scale.",
    description:
      "Annual enterprise subscription: higher-volume BOQ generation, white-label setup included as an implementation service, API enablement subject to configured availability, and priority onboarding/support.",
    purchaseMode: "DIRECT",
    sortOrder: 35,
    prices: [{ code: "enterprise_scale_annual_aed_25000", amountMinor: 2500000, billingInterval: "YEAR" }],
    entitlement: {
      maxUsers: 100,
      maxWorkspaces: 50,
      maxActiveProjects: null,
      maxBoqGenerationsPerMonth: 1500,
      maxTechnicalReportsPerMonth: 750,
      maxWatermarkFreeExportsPerMonth: 750,
      permittedExportFormats: ["PDF", "DOCX", "XLSX", "CSV"],
      removesWatermark: true,
      allowsCompanyBranding: true,
      allowsApiAccess: true,
      allowsWhiteLabel: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  {
    code: "enterprise_authority",
    type: "SUBSCRIPTION",
    name: "Enterprise Authority",
    shortDescription: "For large groups, consultancies and institutional customers needing dedicated onboarding.",
    description:
      "Annual enterprise subscription: unlimited user and workspace commercial allowance, full white-label setup included as an implementation service, private catalogue/data onboarding and executive-priority support.",
    purchaseMode: "DIRECT",
    sortOrder: 36,
    prices: [{ code: "enterprise_authority_annual_aed_35000", amountMinor: 3500000, billingInterval: "YEAR" }],
    entitlement: {
      maxUsers: null,
      maxWorkspaces: null,
      maxActiveProjects: null,
      maxBoqGenerationsPerMonth: 5000,
      maxTechnicalReportsPerMonth: 2500,
      maxWatermarkFreeExportsPerMonth: 2500,
      permittedExportFormats: ["PDF", "DOCX", "XLSX", "CSV"],
      removesWatermark: true,
      allowsCompanyBranding: true,
      allowsApiAccess: true,
      allowsWhiteLabel: true,
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
    },
  },
  {
    code: "tayqan_day",
    type: "ONE_TIME",
    name: "TAYQAN — Day Hire",
    shortDescription: "Hire TAYQAN, your AI Quantity Surveyor, for 24 hours.",
    description: "A one-time 24-hour TAYQAN hire for project inspection, governed quantity-surveying work, BOQ preparation or review, and human-ready acceptance output.",
    purchaseMode: "DIRECT",
    sortOrder: 31,
    prices: [
      {
        code: "tayqan_day_299",
        amountMinor: 29900,
        billingInterval: "ONE_TIME",
      },
    ],
    entitlement: {
      entitlementDurationDays: 1,
    },
  },
  {
    code: "tayqan_week",
    type: "ONE_TIME",
    name: "TAYQAN — Week Hire",
    shortDescription: "Hire TAYQAN for seven days of continuous QS work.",
    description: "A one-time 7-day TAYQAN hire for multi-day project inspection, quantity work, BOQ preparation or review, governed rate preparation when requested, and resumable work orders.",
    purchaseMode: "DIRECT",
    sortOrder: 32,
    prices: [
      {
        code: "tayqan_week_999",
        amountMinor: 99900,
        billingInterval: "ONE_TIME",
      },
    ],
    entitlement: {
      entitlementDurationDays: 7,
    },
  },
  {
    code: "tayqan_monthly",
    type: "SUBSCRIPTION",
    name: "TAYQAN — Digital QS",
    shortDescription: "Your monthly AI Quantity Surveyor.",
    description: "A recurring monthly TAYQAN hire for companies that need a persistent Digital QS across project workflows while keeping final professional acceptance under human control.",
    purchaseMode: "DIRECT",
    sortOrder: 33,
    prices: [
      {
        code: "tayqan_monthly_2499",
        amountMinor: 249900,
        billingInterval: "MONTH",
      },
    ],
    entitlement: {
      entitlementDurationDays: 30,
    },
  },
  {
    code: "boq_single_export",
    type: "ONE_TIME",
    name: "Single BOQ Export",
    shortDescription: "One watermark-free export of a single BOQ.",
    description: "A one-time unlock granting a single watermark-free BOQ export/download.",
    sortOrder: 40,
    prices: [{ code: "boq_single_export_aed_99", amountMinor: 9900, billingInterval: "ONE_TIME" }],
    entitlement: { downloadLimit: 1, maxWatermarkFreeExportsPerMonth: 1, removesWatermark: true },
  },
  {
    code: "technical_report_single",
    type: "ONE_TIME",
    name: "Single Technical Report Export",
    shortDescription: "One watermark-free export of a single technical report.",
    description: "A one-time unlock granting a single watermark-free technical report export/download.",
    sortOrder: 50,
    prices: [{ code: "technical_report_single_aed_149", amountMinor: 14900, billingInterval: "ONE_TIME" }],
    entitlement: { downloadLimit: 1, maxTechnicalReportsPerMonth: 1, removesWatermark: true },
  },
  {
    code: "proposal_export_single",
    type: "ONE_TIME",
    name: "Single Proposal Export",
    shortDescription: "One watermark-free client proposal export.",
    description: "A one-time unlock granting a single watermark-free proposal export/download.",
    sortOrder: 60,
    prices: [{ code: "proposal_export_single_aed_79", amountMinor: 7900, billingInterval: "ONE_TIME" }],
    entitlement: { downloadLimit: 1, removesWatermark: true },
  },
  {
    code: "boq_bundle_5",
    type: "ONE_TIME",
    name: "BOQ Export Bundle (5)",
    shortDescription: "Five watermark-free BOQ exports, purchased together.",
    description: "A one-time bundle unlocking five watermark-free BOQ exports/downloads.",
    sortOrder: 70,
    prices: [{ code: "boq_bundle_5_aed_399", amountMinor: 39900, billingInterval: "ONE_TIME" }],
    entitlement: { downloadLimit: 5, maxWatermarkFreeExportsPerMonth: 5, removesWatermark: true },
  },
  {
    code: "tender_package",
    type: "ONE_TIME",
    name: "Tender Submission Package",
    shortDescription: "A bundled export set (BOQ, technical report, proposal) for a tender submission.",
    description: "A one-time bundle covering the full document set typically required for a single tender submission.",
    sortOrder: 80,
    prices: [{ code: "tender_package_aed_999", amountMinor: 99900, billingInterval: "ONE_TIME" }],
    entitlement: { downloadLimit: 10, removesWatermark: true, permittedExportFormats: ["PDF", "DOCX", "XLSX"] },
  },
  {
    code: "ai_credits_pack_100",
    type: "AI_CREDIT_PACK",
    name: "AI Credits — 100",
    shortDescription: "100 AI credits for AI-assisted BOQ/report generation.",
    description: "A one-time top-up of 100 AI credits. No AI credit ledger exists yet to consume this grant — see entitlement enforcement status.",
    sortOrder: 90,
    prices: [{ code: "ai_credits_pack_100_aed_49", amountMinor: 4900, billingInterval: "ONE_TIME" }],
    entitlement: { aiCreditsGranted: 100, entitlementDurationDays: 365 },
  },
  {
    code: "ai_credits_pack_500",
    type: "AI_CREDIT_PACK",
    name: "AI Credits — 500",
    shortDescription: "500 AI credits for AI-assisted BOQ/report generation.",
    description: "A one-time top-up of 500 AI credits. No AI credit ledger exists yet to consume this grant — see entitlement enforcement status.",
    sortOrder: 100,
    prices: [{ code: "ai_credits_pack_500_aed_199", amountMinor: 19900, billingInterval: "ONE_TIME" }],
    entitlement: { aiCreditsGranted: 500, entitlementDurationDays: 365 },
  },
  {
    code: "ai_credits_pack_2000",
    type: "AI_CREDIT_PACK",
    name: "AI Credits — 2000",
    shortDescription: "2000 AI credits for AI-assisted BOQ/report generation.",
    description: "A one-time top-up of 2000 AI credits. No AI credit ledger exists yet to consume this grant — see entitlement enforcement status.",
    sortOrder: 110,
    prices: [{ code: "ai_credits_pack_2000_aed_699", amountMinor: 69900, billingInterval: "ONE_TIME" }],
    entitlement: { aiCreditsGranted: 2000, entitlementDurationDays: 365 },
  },
  {
    code: "api_access",
    type: "ADD_ON",
    name: "API Access",
    shortDescription: "Programmatic access to the platform API.",
    description: "A recurring add-on granting API access. Priced from AED 499/mo — final price depends on usage tier, agreed via quotation.",
    purchaseMode: "QUOTATION_REQUIRED",
    sortOrder: 120,
    prices: [{ code: "api_access_monthly_from_aed_499", amountMinor: 49900, billingInterval: "MONTH", isFromPrice: true }],
    entitlement: { allowsApiAccess: true, entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS },
  },
  {
    code: "white_label",
    type: "ADD_ON",
    name: "White Label",
    shortDescription: "Remove Quantara branding and apply full company branding across exports.",
    description: "A one-time setup add-on for full white-label branding. Priced from AED 5,000 — final price depends on scope, agreed via quotation.",
    purchaseMode: "QUOTATION_REQUIRED",
    sortOrder: 130,
    prices: [{ code: "white_label_from_aed_5000", amountMinor: 500000, billingInterval: "ONE_TIME", isFromPrice: true }],
    entitlement: { allowsWhiteLabel: true, allowsCompanyBranding: true },
  },
  {
    code: "custom_ai_training",
    type: "ADD_ON",
    name: "Custom AI Training",
    shortDescription: "AI model tuning against a company's own historical BOQ data.",
    description: "A one-time professional-services engagement. Priced from AED 7,500 — final scope and price agreed via quotation.",
    purchaseMode: "CONTACT_SALES",
    sortOrder: 140,
    prices: [{ code: "custom_ai_training_from_aed_7500", amountMinor: 750000, billingInterval: "ONE_TIME", isFromPrice: true }],
    entitlement: {},
  },
  {
    code: "custom_template",
    type: "ADD_ON",
    name: "Custom Document Template",
    shortDescription: "A bespoke BOQ/report/proposal template built to a company's own format.",
    description: "A one-time template design engagement. Priced from AED 1,500 — final scope and price agreed via quotation.",
    purchaseMode: "QUOTATION_REQUIRED",
    sortOrder: 150,
    prices: [{ code: "custom_template_from_aed_1500", amountMinor: 150000, billingInterval: "ONE_TIME", isFromPrice: true }],
    entitlement: {},
  },
  {
    code: "enterprise_installation",
    type: "ENTERPRISE",
    name: "Enterprise Installation",
    shortDescription: "Full enterprise onboarding: custom roles, approval chains, regional hosting.",
    description: "A one-time enterprise onboarding engagement. Priced from AED 15,000 — always routed through a human sales quotation, never self-checkout.",
    purchaseMode: "CONTACT_SALES",
    sortOrder: 160,
    prices: [{ code: "enterprise_installation_from_aed_15000", amountMinor: 1500000, billingInterval: "ONE_TIME", isFromPrice: true }],
    entitlement: {},
  },
];

/** Candidate industry-access SKUs. Only keys with a real, existing
 *  IndustryDataPackage row get a CommerceProduct — everything else is
 *  skipped and counted so the report is honest about what isn't real yet.
 *
 *  MARKETPLACE-FULL-STRIPE-LINK — the previous 18-entry list used a stale
 *  `-professional` naming scheme that matched ZERO real IndustryDataPackage
 *  rows except `mechanical-hvac-professional` (a separate pilot package
 *  seeded by ./commercial.ts's seedMechanicalPackage, kept below — do not
 *  confuse it with the 15 real library packages, and do not remove it:
 *  tests/commerce-product-service.test.ts and several others genuinely
 *  depend on seedCommerceProducts creating/updating its CommerceProduct via
 *  this exact loop). The other 17 stale `-professional` entries were
 *  confirmed dead (grepped the whole repo — no other reference anywhere)
 *  and are replaced here with the 15 real `-library` keys from
 *  src/config/libraries.ts's CATALOGUE_LIBRARIES, the live config the
 *  marketplace UI actually uses. sortOrder 220+ is a fresh range, distinct
 *  from both CATALOGUE_PRODUCTS' (10-160) and the pilot entry's (200). */
const INDUSTRY_ACCESS_CANDIDATES: { key: string; name: string; sortOrder: number }[] = [
  { key: "mechanical-hvac-professional", name: "Mechanical & HVAC Professional Library", sortOrder: 200 },
  { key: "architectural-finishes-library", name: "Architectural Finishes Library", sortOrder: 220 },
  { key: "bim-digital-deliverables-library", name: "BIM & Digital Deliverables Library", sortOrder: 221 },
  { key: "civil-works-library", name: "Civil Works Library", sortOrder: 222 },
  { key: "closeout-library", name: "Closeout Library", sortOrder: 223 },
  { key: "doors-and-windows-library", name: "Doors and Windows Library", sortOrder: 224 },
  { key: "facade-library", name: "Facade Library", sortOrder: 225 },
  { key: "general-requirements-library", name: "General Requirements Library", sortOrder: 226 },
  { key: "hvac-library", name: "HVAC Library", sortOrder: 227 },
  { key: "landscaping-library", name: "Landscaping Library", sortOrder: 228 },
  { key: "plumbing-library", name: "Plumbing Library", sortOrder: 229 },
  { key: "roofing-library", name: "Roofing Library", sortOrder: 230 },
  { key: "site-infrastructure-library", name: "Site Infrastructure Library", sortOrder: 231 },
  { key: "structural-library", name: "Structural Library", sortOrder: 232 },
  { key: "temporary-works-library", name: "Temporary Works Library", sortOrder: 233 },
  { key: "uae-authority-regulatory-library", name: "UAE Authority & Regulatory Library", sortOrder: 234 },
];

async function seedCatalogueProduct(prisma: PrismaClient, spec: ProductSpec, report: CommerceSeedReport): Promise<void> {
  const existing = await prisma.commerceProduct.findUnique({ where: { code: spec.code } });
  const productData = {
    type: spec.type,
    name: spec.name,
    shortDescription: spec.shortDescription,
    description: spec.description,
    purchaseMode: spec.purchaseMode ?? "DIRECT",
    isActive: true,
    isPublic: true,
    sortOrder: spec.sortOrder,
  } as const;

  let productId: string;
  if (existing) {
    const changed =
      existing.name !== productData.name ||
      existing.shortDescription !== productData.shortDescription ||
      existing.description !== productData.description ||
      existing.purchaseMode !== productData.purchaseMode ||
      existing.sortOrder !== productData.sortOrder;
    await prisma.commerceProduct.update({ where: { id: existing.id }, data: productData });
    productId = existing.id;
    if (changed) report.productsUpdated += 1;
    else report.productsUnchanged += 1;
  } else {
    const created = await prisma.commerceProduct.create({ data: { code: spec.code, ...productData } });
    productId = created.id;
    report.productsInserted += 1;
  }

  for (const priceSpec of spec.prices) {
    const existingPrice = await prisma.commercePrice.findUnique({ where: { code: priceSpec.code } });
    if (
      existingPrice &&
      existingPrice.amountMinor === priceSpec.amountMinor &&
      existingPrice.billingInterval === priceSpec.billingInterval &&
      existingPrice.isFromPrice === (priceSpec.isFromPrice ?? false)
    ) {
      report.pricesUnchanged += 1;
      continue;
    }
    if (existingPrice) {
      await prisma.commercePrice.update({ where: { id: existingPrice.id }, data: { isActive: false, validUntil: new Date() } });
      report.pricesArchived += 1;
    }
    await prisma.commercePrice.create({
      data: {
        productId,
        code: existingPrice ? `${priceSpec.code}_v${Date.now()}` : priceSpec.code,
        amountMinor: priceSpec.amountMinor,
        currency: "AED",
        billingInterval: priceSpec.billingInterval,
        isFromPrice: priceSpec.isFromPrice ?? false,
        isActive: true,
      },
    });
    report.pricesInserted += 1;
  }

  const existingTemplate = await prisma.entitlementTemplate.findUnique({ where: { productId } });
  const templateData = {
    maxUsers: spec.entitlement.maxUsers ?? null,
    maxWorkspaces: spec.entitlement.maxWorkspaces ?? null,
    maxActiveProjects: spec.entitlement.maxActiveProjects ?? null,
    maxBoqGenerationsPerMonth: spec.entitlement.maxBoqGenerationsPerMonth ?? null,
    maxTechnicalReportsPerMonth: spec.entitlement.maxTechnicalReportsPerMonth ?? null,
    maxWatermarkFreeExportsPerMonth: spec.entitlement.maxWatermarkFreeExportsPerMonth ?? null,
    permittedExportFormatsJson: spec.entitlement.permittedExportFormats ?? [],
    removesWatermark: spec.entitlement.removesWatermark ?? false,
    allowsCompanyBranding: spec.entitlement.allowsCompanyBranding ?? false,
    allowsApiAccess: spec.entitlement.allowsApiAccess ?? false,
    allowsWhiteLabel: spec.entitlement.allowsWhiteLabel ?? false,
    industryPackageKeysJson: spec.entitlement.industryPackageKeys ?? [],
    aiCreditsGranted: spec.entitlement.aiCreditsGranted ?? null,
    downloadLimit: spec.entitlement.downloadLimit ?? null,
    entitlementDurationDays: spec.entitlement.entitlementDurationDays ?? null,
  };
  if (existingTemplate) {
    await prisma.entitlementTemplate.update({ where: { id: existingTemplate.id }, data: templateData });
    report.templatesUpdated += 1;
  } else {
    await prisma.entitlementTemplate.create({ data: { productId, ...templateData } });
    report.templatesInserted += 1;
  }
}

export async function seedCommerceProducts(prisma: PrismaClient): Promise<CommerceSeedReport> {
  const report: CommerceSeedReport = {
    productsInserted: 0,
    productsUpdated: 0,
    productsUnchanged: 0,
    pricesInserted: 0,
    pricesUnchanged: 0,
    pricesArchived: 0,
    templatesInserted: 0,
    templatesUpdated: 0,
    industryProductsCreated: [],
    industryProductsSkipped: [],
  };

  for (const spec of CATALOGUE_PRODUCTS) {
    await seedCatalogueProduct(prisma, spec, report);
  }

  for (const candidate of INDUSTRY_ACCESS_CANDIDATES) {
    const pkg = await prisma.industryDataPackage.findUnique({ where: { key: candidate.key } });
    if (!pkg) {
      report.industryProductsSkipped.push({ key: candidate.key, reason: "No backing IndustryDataPackage exists for this key yet." });
      continue;
    }

    const productCode = `industry_${candidate.key.replace(/-/g, "_")}`;
    const existing = await prisma.commerceProduct.findUnique({ where: { code: productCode } });
    const productData = {
      type: "SUBSCRIPTION" as const,
      name: `${candidate.name} Access`,
      shortDescription: `Recurring access to the ${candidate.name}.`,
      description: `Recurring access to the ${candidate.name} industry data package.`,
      purchaseMode: "DIRECT" as const,
      isActive: true,
      isPublic: true,
      sortOrder: candidate.sortOrder,
      industryPackageId: pkg.id,
    };

    let productId: string;
    if (existing) {
      const changed = existing.industryPackageId !== pkg.id || existing.name !== productData.name;
      await prisma.commerceProduct.update({ where: { id: existing.id }, data: productData });
      productId = existing.id;
      if (changed) report.productsUpdated += 1;
      else report.productsUnchanged += 1;
    } else {
      const created = await prisma.commerceProduct.create({ data: { code: productCode, ...productData } });
      productId = created.id;
      report.productsInserted += 1;
    }

    const monthlyMinor = Math.round(Number(pkg.monthlyPrice) * 100);
    const annualMinor = Math.round(Number(pkg.annualPrice) * 100);
    const priceSpecs: PriceSpec[] = [
      { code: `industry_${candidate.key.replace(/-/g, "_")}_monthly`, amountMinor: monthlyMinor, billingInterval: "MONTH" },
      { code: `industry_${candidate.key.replace(/-/g, "_")}_annual`, amountMinor: annualMinor, billingInterval: "YEAR" },
    ];
    for (const priceSpec of priceSpecs) {
      const existingPrice = await prisma.commercePrice.findUnique({ where: { code: priceSpec.code } });
      if (existingPrice && existingPrice.amountMinor === priceSpec.amountMinor && existingPrice.billingInterval === priceSpec.billingInterval) {
        report.pricesUnchanged += 1;
        continue;
      }
      if (existingPrice) {
        await prisma.commercePrice.update({ where: { id: existingPrice.id }, data: { isActive: false, validUntil: new Date() } });
        report.pricesArchived += 1;
      }
      await prisma.commercePrice.create({
        data: {
          productId,
          code: existingPrice ? `${priceSpec.code}_v${Date.now()}` : priceSpec.code,
          amountMinor: priceSpec.amountMinor,
          currency: "AED",
          billingInterval: priceSpec.billingInterval,
          isActive: true,
        },
      });
      report.pricesInserted += 1;
    }

    const existingTemplate = await prisma.entitlementTemplate.findUnique({ where: { productId } });
    const templateData = {
      industryPackageKeysJson: [candidate.key],
      entitlementDurationDays: SUBSCRIPTION_TEMPLATE_DURATION_DAYS,
      permittedExportFormatsJson: [],
      removesWatermark: false,
      allowsCompanyBranding: false,
      allowsApiAccess: false,
      allowsWhiteLabel: false,
      maxUsers: null,
      maxWorkspaces: null,
      maxActiveProjects: null,
      maxBoqGenerationsPerMonth: null,
      maxTechnicalReportsPerMonth: null,
      maxWatermarkFreeExportsPerMonth: null,
      aiCreditsGranted: null,
      downloadLimit: null,
    };
    if (existingTemplate) {
      await prisma.entitlementTemplate.update({ where: { id: existingTemplate.id }, data: templateData });
      report.templatesUpdated += 1;
    } else {
      await prisma.entitlementTemplate.create({ data: { productId, ...templateData } });
      report.templatesInserted += 1;
    }

    report.industryProductsCreated.push(candidate.key);
  }

  return report;
}

const ENTERPRISE_PRODUCT_CODES = ["enterprise_core", "enterprise_scale", "enterprise_authority"] as const;

/**
 * CORRECTION-1 mission 5 — target-only production activation for the three
 * Enterprise tiers. Unlike seedCommerceProducts above (which iterates the
 * ENTIRE CATALOGUE_PRODUCTS array plus every INDUSTRY_ACCESS_CANDIDATES
 * library), this touches ONLY the CommerceProduct/CommercePrice/
 * EntitlementTemplate rows for enterprise_core/enterprise_scale/
 * enterprise_authority — reusing the exact same seedCatalogueProduct upsert
 * logic (so behavior is byte-identical to what seedCommerceProducts would do
 * for these three products), with a hard, structural guarantee that
 * Starter, Professional, Business, TAYQAN, every Industry Library, and any
 * future catalogue product are never read or written by this function.
 * Idempotent — safe to run more than once against production.
 *
 * New/changed prices still default to reviewStatus: REQUIRES_REVIEW; owner/
 * admin approval via PATCH /api/admin/commerce/prices/[priceId]/approval
 * (see src/lib/services/commerce-price-approval-service.ts) remains the
 * required next step before these three prices can be synced to LIVE Stripe.
 */
export async function seedEnterpriseCommerceProducts(prisma: PrismaClient): Promise<CommerceSeedReport> {
  const report: CommerceSeedReport = {
    productsInserted: 0,
    productsUpdated: 0,
    productsUnchanged: 0,
    pricesInserted: 0,
    pricesUnchanged: 0,
    pricesArchived: 0,
    templatesInserted: 0,
    templatesUpdated: 0,
    industryProductsCreated: [],
    industryProductsSkipped: [],
  };

  const specs = CATALOGUE_PRODUCTS.filter((spec) => (ENTERPRISE_PRODUCT_CODES as readonly string[]).includes(spec.code));
  if (specs.length !== ENTERPRISE_PRODUCT_CODES.length) {
    throw new Error(
      `seedEnterpriseCommerceProducts: expected exactly ${ENTERPRISE_PRODUCT_CODES.length} Enterprise product specs (${ENTERPRISE_PRODUCT_CODES.join(", ")}) in CATALOGUE_PRODUCTS but found ${specs.length} — refusing to run partially.`,
    );
  }

  for (const spec of specs) {
    await seedCatalogueProduct(prisma, spec, report);
  }

  return report;
}
