import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPublicCapabilityRegisterEntry,
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITIES,
  PUBLIC_PRODUCT_TRUTH_MATRIX,
  PUBLIC_CAPABILITY_REVIEW_DATE,
  QUANTARA_ENTITY_DEFINITION,
  QUANTARA_WORKFLOW_TRUTH,
} from "@/lib/public-site/product-truth";
import { OCR_IMPLEMENTATION_STATUS } from "@/lib/files/pdf-text-extraction";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import { createTranslator } from "@/lib/i18n/translate";

const repoRoot = process.cwd();

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function publicWebsiteSource(): string {
  const publicLayoutFiles = [
    "comparison-page.tsx",
    "industry-landing-page.tsx",
    "knowledge-page.tsx",
    "public-footer.tsx",
    "public-header.tsx",
    "regional-landing-page.tsx",
    "seo-landing-page.tsx",
  ].map((file) => join(repoRoot, "src", "components", "layout", file));
  const files = [
    ...collectSourceFiles(join(repoRoot, "src", "app", "(marketing)")),
    ...publicLayoutFiles,
    ...collectSourceFiles(join(repoRoot, "src", "components", "legal")),
    join(repoRoot, "src", "config", "public-navigation.ts"),
    join(repoRoot, "src", "config", "pricing.ts"),
    join(repoRoot, "src", "lib", "public-features.ts"),
    join(repoRoot, "src", "lib", "config", "features.ts"),
  ];
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("public product truth", () => {
  it("publishes one stable entity definition and acceptance statement", () => {
    expect(QUANTARA_ENTITY_DEFINITION).toBe(
      "Quantara is drawing-to-BOQ quantity takeoff software that generates structured, quantity-complete unpriced bills of quantities with calculation evidence, source provenance and engineer-controlled review.",
    );
    expect(QUANTARA_WORKFLOW_TRUTH).toBe(
      "Users select a supported industry and upload the project drawing set. Quantara prepares a traceable, quantity-complete unpriced BOQ, records assumptions and unresolved evidence, and keeps rates, final review, revision locking and issue under professional control.",
    );
    expect(PROFESSIONAL_REVIEW_NOTICE).toContain("require review");
  });

  it("keeps every capability ID unique and every limitation explicit", () => {
    expect(new Set(PUBLIC_CAPABILITIES.map((capability) => capability.id)).size).toBe(PUBLIC_CAPABILITIES.length);

    for (const capability of PUBLIC_CAPABILITIES) {
      expect(capability.name.trim().length).toBeGreaterThan(0);
      expect(capability.summary.trim().length).toBeGreaterThan(0);
      if (capability.status === "LIMITED" || capability.status === "CONTROLLED_ACCESS") {
        expect(capability.limitation?.trim().length, capability.id).toBeGreaterThan(0);
      }
    }
  });

  it("states high-risk capabilities at their verified availability level", () => {
    const byId = new Map(PUBLIC_CAPABILITIES.map((capability) => [capability.id, capability]));

    expect(byId.get("scanned-pdf-ocr")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("automatic-drawing-takeoff")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("single-sign-on")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("non-google-external-integrations")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("enterprise-feature-bundle")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("typed-multi-change-proposals")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("visible-calculations")?.status).toBe("AVAILABLE");
    expect(byId.get("source-attribution")?.status).toBe("LIMITED");
    expect(byId.get("google-drive-import")?.status).toBe("CONTROLLED_ACCESS");
    expect(byId.get("voice-proposals")?.status).toBe("AVAILABLE");
    expect(byId.get("voice-proposals")?.name).toBe("Voice-assisted measurement and BOQ editing");
    expect(byId.get("voice-proposals")?.summary).toContain("enter or correct measurements");
    expect(byId.get("autodesk-dwg-analysis")?.status).toBe("CONTROLLED_ACCESS");
    expect(byId.get("autodesk-dwg-analysis")?.name).toBe("Autodesk / AutoCAD DWG analysis");
    expect(byId.get("autodesk-dwg-analysis")?.summary).toContain("traceable Quantara review candidates");
    expect(byId.get("commercial-access")?.summary).toContain("Published Starter, Professional, Business, Enterprise Core, Enterprise Scale, and Enterprise Authority subscriptions");
    expect(byId.get("commercial-access")?.summary).toContain("eligible authenticated checkout");
    expect(byId.get("commercial-access")?.limitation).toContain("selected approved and active price");
    expect(byId.get("commercial-access")?.limitation).toContain("active synchronized provider mapping");
    expect(byId.get("commercial-access")?.limitation).toContain("Anonymous or unauthenticated checkout is not offered");
    expect(byId.get("technical-report-generation")?.status).toBe("LIMITED");
    expect(byId.get("technical-report-generation")?.limitation).toContain("limited to DOCX");
    expect(byId.get("model-file-import")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("model-file-import")?.summary).toContain("does not limit supported Autodesk");
    expect(OCR_IMPLEMENTATION_STATUS).toBe("NOT_IMPLEMENTED");
  });

  it("publishes a lifecycle matrix without changing the established public status taxonomy", () => {
    const lifecycleById = new Map(
      PUBLIC_PRODUCT_TRUTH_MATRIX.map((capability) => [capability.id, capability.lifecycle]),
    );

    expect(PUBLIC_PRODUCT_TRUTH_MATRIX).toBe(PUBLIC_CAPABILITIES);
    expect(lifecycleById.get("project-workspaces")).toBe("LIVE");
    expect(lifecycleById.get("scanned-pdf-detection")).toBe("LIVE");
    expect(lifecycleById.get("visible-calculations")).toBe("LIVE");
    expect(lifecycleById.get("voice-proposals")).toBe("LIVE");
    expect(lifecycleById.get("autodesk-dwg-analysis")).toBe("BETA_LIMITED");
    expect(lifecycleById.get("commercial-access")).toBe("BETA_LIMITED");
    expect(lifecycleById.get("technical-report-generation")).toBe("BETA_LIMITED");
    expect(lifecycleById.get("non-google-external-integrations")).toBe("PLANNED");
    expect(lifecycleById.get("enterprise-feature-bundle")).toBe("PLANNED");
    expect(lifecycleById.get("automatic-drawing-takeoff")).toBe("NOT_AVAILABLE");
    expect(lifecycleById.get("scanned-pdf-ocr")).toBe("NOT_AVAILABLE");

    for (const capability of PUBLIC_PRODUCT_TRUTH_MATRIX) {
      expect(["LIVE", "BETA_LIMITED", "PLANNED", "NOT_AVAILABLE"]).toContain(
        capability.lifecycle,
      );
    }

    expect(
      new Set(PUBLIC_PRODUCT_TRUTH_MATRIX.map((capability) => capability.lifecycle)),
    ).toEqual(new Set(["LIVE", "BETA_LIMITED", "PLANNED", "NOT_AVAILABLE"]));
  });

  it("links every capability classification to repository evidence", () => {
    for (const capability of PUBLIC_PRODUCT_TRUTH_MATRIX) {
      expect(capability.evidencePaths.length, capability.id).toBeGreaterThan(0);
      for (const evidencePath of capability.evidencePaths) {
        expect(evidencePath.trim().length, capability.id).toBeGreaterThan(0);
        expect(existsSync(join(repoRoot, evidencePath)), `${capability.id}: ${evidencePath}`).toBe(true);
      }
    }

    const autodeskDwgAnalysis = PUBLIC_PRODUCT_TRUTH_MATRIX.find(
      (capability) => capability.id === "autodesk-dwg-analysis",
    );
    expect(autodeskDwgAnalysis?.evidencePaths).toEqual([
      "src/lib/services/autodesk-candidate-service.ts",
      "tests/autodesk-integration.test.ts",
    ]);
  });

  it("publishes guided measurement while retaining the narrow unattended-geometry boundary", () => {
    const targetSources = [
      "src/lib/public-site/product-truth.ts",
      "src/app/(marketing)/page.tsx",
      "src/app/(marketing)/ai-boq-software/page.tsx",
      "src/lib/i18n/dictionaries/en.ts",
      "src/lib/i18n/dictionaries/ar.ts",
      "public/llms.txt",
    ]
      .map((path) => readFileSync(join(repoRoot, path), "utf8"))
      .join("\n");

    expect(targetSources).not.toContain("Quantara does not measure");
    expect(targetSources).not.toContain("Quantara cannot measure");
    expect(targetSources).not.toContain("Quantara does not calculate quantities");
    expect(targetSources).not.toContain("Quantara is not quantity takeoff software");
    expect(targetSources).toContain(
      "Quantara does not make a blanket claim of fully unattended computer-vision takeoff",
    );
    expect(targetSources).toContain("This limitation does not apply to Quantara's available guided BOQ measurement");
    expect(targetSources).toContain("professional confirmation");
  });

  it("publishes evidence-backed SaaS capabilities with explicit operating boundaries", () => {
    const byId = new Map(PUBLIC_CAPABILITIES.map((capability) => [capability.id, capability]));
    const reviewedCapabilityIds = [
      "client-records",
      "spreadsheet-import",
      "internal-supplier-rate-catalogue",
      "company-library",
      "voice-proposals",
      "client-proposals",
      "bilingual-rtl-interface",
    ];

    for (const id of reviewedCapabilityIds) {
      expect(byId.get(id)?.evidenceLevel, id).toBe("SOURCE_AND_TESTS_REVIEWED");
      expect(byId.get(id)?.reviewedAt, id).toBe(PUBLIC_CAPABILITY_REVIEW_DATE);
    }

    expect(byId.get("client-proposals")?.summary).toContain("token-gated proposal link");
    expect(byId.get("client-proposals")?.summary).toContain("completed technical report");
    expect(byId.get("client-proposals")?.limitation).toContain("not electronic signatures");
    expect(byId.get("internal-supplier-rate-catalogue")?.limitation).toContain("does not provide automated supplier feeds or live market pricing");
    expect(byId.get("company-library")?.limitation).toContain("depends on published data");
    expect(byId.get("spreadsheet-import")?.summary).toContain("approve selected records");
    expect(byId.get("bilingual-rtl-interface")?.limitation).toContain("does not perform Arabic OCR, translate content or parse Arabic project sources");
    expect(byId.get("voice-proposals")?.summary).toContain("change, addition or deletion");
    expect(byId.get("voice-proposals")?.limitation).toContain("signed confirmation");

  });

  it("keeps enriched capability-register copy and dependencies aligned in English and Arabic", () => {
    const english = createTranslator(en);
    const arabic = createTranslator(ar);
    const localizedCapabilityIds = [
      "client-records",
      "spreadsheet-import",
      "internal-supplier-rate-catalogue",
      "voice-proposals",
      "client-proposals",
      "company-library",
      "bilingual-rtl-interface",
    ] as const;

    for (const id of localizedCapabilityIds) {
      const canonical = PUBLIC_CAPABILITIES.find((capability) => capability.id === id);
      expect(canonical, id).toBeDefined();

      const englishEntry = getPublicCapabilityRegisterEntry(id, english);
      expect(englishEntry.name, `${id}: English name`).toBe(canonical?.name);
      expect(englishEntry.summary, `${id}: English summary`).toBe(canonical?.summary);
      expect(englishEntry.limitation, `${id}: English limitation`).toBe(canonical?.limitation);
      expect(englishEntry.dependencies, `${id}: English dependencies`).toEqual(canonical?.dependencies);

      const arabicEntry = getPublicCapabilityRegisterEntry(id, arabic);
      expect(arabicEntry.name, `${id}: Arabic name`).not.toBe(canonical?.name);
      expect(arabicEntry.summary, `${id}: Arabic summary`).not.toBe(canonical?.summary);
      if (canonical?.limitation) {
        expect(arabicEntry.limitation, `${id}: Arabic limitation`).not.toBe(canonical.limitation);
      }
      if (canonical?.dependencies?.length) {
        expect(arabicEntry.dependencies, `${id}: Arabic dependency count`).toHaveLength(
          canonical.dependencies.length,
        );
        for (const [index, dependency] of canonical.dependencies.entries()) {
          expect(
            arabicEntry.dependencies?.[index],
            `${id}: Arabic dependency ${index + 1}`,
          ).not.toBe(dependency);
        }
      }
    }
  });

  it("marks the tokenized technical-report page as a private noindex utility", () => {
    const source = readFileSync(
      join(repoRoot, "src", "app", "technical-report", "[token]", "page.tsx"),
      "utf8",
    );

    expect(source).toContain("createPrivateUtilityMetadata");
    expect(source).toContain("Private token-based technical-report review utility.");
  });

  it("derives public availability badges from Product Truth instead of page-local status strings", () => {
    const source = publicWebsiteSource();
    const seoTemplate = readFileSync(
      join(repoRoot, "src", "components", "layout", "seo-landing-page.tsx"),
      "utf8",
    );
    const navigation = readFileSync(join(repoRoot, "src", "config", "public-navigation.ts"), "utf8");

    expect(source).not.toMatch(/\bstatus\s*:\s*["'](?:Available|Controlled access|Limited|Not available)["']/);
    expect(seoTemplate).toContain("getPublicCapability(capabilityId).status");
    expect(seoTemplate).toContain("getPublicStatus(feature.capabilityId, t)");
    expect(navigation).not.toContain("PUBLIC_CAPABILITY_STATUS_LABELS");
    expect(navigation).not.toContain("googleDriveImport.status");
    expect(navigation).toContain('href: "/boq-integrations/google-drive"');
  });

  it("cannot present OCR as available while the implementation reports it missing", () => {
    const source = publicWebsiteSource();

    expect(OCR_IMPLEMENTATION_STATUS).toBe("NOT_IMPLEMENTED");
    expect(source).not.toMatch(/Quantara[^.\n]{0,120}\b(?:supports|provides|performs|includes)\b[^.\n]{0,80}\bOCR\b/i);
    expect(source).not.toMatch(/\b(?:OCR|Scanned PDF OCR)[^\n]{0,80}\bstatus\s*:\s*["']Available["']/i);
  });

  it("keeps stored PDF text separate from supported table-row candidates", () => {
    const source = publicWebsiteSource();
    const textPdfCapability = PUBLIC_CAPABILITIES.find(
      (capability) => capability.id === "text-pdf-extraction",
    );

    expect(textPdfCapability?.summary).toContain("supported detected table rows");
    expect(textPdfCapability?.limitation).toContain("Plain paragraph text is not automatically converted");
    expect(source).not.toMatch(/captures supported text and table information into a reviewable structure/i);
    expect(source).not.toMatch(/supported information[^.\n]{0,100}captured into a review queue/i);
    expect(source).not.toMatch(/Durable production storage/i);
  });

  it("proves Arabic sales truth includes correct enterprise prices and rejects corrupted strings", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const repoRoot = process.cwd();
    const arDictionary = readFileSync(join(repoRoot, "src", "lib", "i18n", "dictionaries", "ar.ts"), "utf8");
    const salesTruth = readFileSync(join(repoRoot, "src", "lib", "public-site", "sales-truth.ts"), "utf8");

    const combined = arDictionary + " " + salesTruth;

    expect(combined).toContain("Enterprise Core");
    expect(combined).toContain("Enterprise Scale");
    expect(combined).toContain("Enterprise Authority");
    expect(combined).toContain("15,000");
    expect(combined).toContain("25,000");
    expect(combined).toContain("35,000");

    const corruptedStrings = [
      "الماسسات", "ىمك؆", "المؤطل", "الرعر", "المححد", "المجسسات", "المححدة", "سنوو", "متباشر", "التنفيد", "غاير", "المتاشرة"
    ];

    for (const str of corruptedStrings) {
      expect(combined).not.toContain(str);
    }
  });

  it("does not publish unverified self-serve prices or conversion claims", () => {
    const source = publicWebsiteSource();

    expect(source).not.toMatch(/\bBuy Now\b/i);
    expect(source).not.toMatch(/\bSubscribe\b/i);
    expect(source).not.toMatch(/\bStarter\b[^\n]{0,100}\b1\s+project\b/i);
    expect(source).not.toMatch(/\bProfessional\b[^\n]{0,100}\b5\s+projects\b/i);
    expect(source).not.toMatch(/\bFull Source Traceability\b/i);
    expect(source).not.toMatch(/\b24\s*\/\s*7 support\b/i);
    expect(source).not.toMatch(/Request Early Access/i);
    expect(source).toContain('t("publicContent.pricing.hero")');
    expect(source).toContain("getPublicSalesTruth");
  });

  it("publishes exact owner-approved public subscription prices with static price codes only", () => {
    const source = publicWebsiteSource();

    expect(source).toContain("starter_monthly_aed_149");
    expect(source).toContain("starter_annual_aed_1490");
    expect(source).toContain("professional_monthly_aed_399");
    expect(source).toContain("professional_annual_aed_3990");
    expect(source).toContain("business_monthly_aed_899");
    expect(source).toContain("business_annual_aed_8990");

    // Enterprise prices
    expect(source).toMatch(/AED\s*15,?000/i);
    expect(source).toMatch(/AED\s*25,?000/i);
    expect(source).toMatch(/AED\s*35,?000/i);
    
    // Enterprise codes
    expect(source).toContain("enterprise_core_annual_aed_15000");
    expect(source).toContain("enterprise_scale_annual_aed_25000");
    expect(source).toContain("enterprise_authority_annual_aed_35000");

    // Negative assertions for invented Enterprise prices
    expect(source).not.toMatch(/AED\s*14,?999/i);
    expect(source).not.toMatch(/AED\s*25,?001/i);
    expect(source).not.toMatch(/AED\s*35,?001/i);


    expect(source).toContain('t("publicContent.pricing.saasStarterName")');
    expect(source).toContain('t("publicContent.pricing.saasProfessionalName")');
    expect(source).toContain('t("publicContent.pricing.saasBusinessName")');
    expect(source).toContain('t("publicContent.pricing.saasRecommended")');
    expect(source).toContain('t("publicContent.pricing.saasStarterCta")');
    expect(source).toContain('t("publicContent.pricing.saasProfessionalCta")');
    expect(source).toContain('t("publicContent.pricing.saasBusinessCta")');

    expect(source).not.toMatch(/\bprice_[A-Za-z0-9]/);
    expect(source).not.toContain("/api/commerce/checkout");

    const pricingPlansSource = readFileSync(
      join(repoRoot, "src", "app", "(marketing)", "pricing", "pricing-plans.tsx"),
      "utf8",
    );
    const pricingIntentSource = readFileSync(
      join(repoRoot, "src", "lib", "commercial", "pricing-intent.ts"),
      "utf8",
    );
    expect(pricingPlansSource).toContain("normalizePublicPriceCode(cycle.priceCode)");
    expect(pricingPlansSource).toContain("buildRegisterPricingHref(trustedPriceCode)");
    expect(pricingPlansSource).not.toMatch(/href="\/api\/commerce\/checkout"/);
    expect(pricingIntentSource).toContain("TRUSTED_PUBLIC_PRICE_CODES");
    expect(pricingIntentSource).toContain("isTrustedPublicPriceCode(record.priceCode)");
    expect(pricingIntentSource).not.toMatch(/\bprice_[A-Za-z0-9]/);
  });
});
