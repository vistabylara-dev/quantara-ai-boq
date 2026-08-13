import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITIES,
  PUBLIC_PRODUCT_TRUTH_MATRIX,
  QUANTARA_ENTITY_DEFINITION,
  QUANTARA_WORKFLOW_TRUTH,
} from "@/lib/public-site/product-truth";
import { OCR_IMPLEMENTATION_STATUS } from "@/lib/files/pdf-text-extraction";

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
      "Quantara is AI-assisted BOQ measurement and quantity calculation software for construction professionals.",
    );
    expect(QUANTARA_WORKFLOW_TRUTH).toBe(
      "Quantara brings project sources, reviewable extraction, guided measurement, deterministic quantity calculations and professional BOQ workflows together in one controlled platform. Review source-linked or professionally entered dimensions, see the engineering equation and calculated quantity, and confirm the result into your BOQ workflow.",
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
    expect(byId.get("commercial-access")?.summary).toContain("Authenticated recurring subscription checkout");
    expect(byId.get("commercial-access")?.limitation).toContain("public website does not offer checkout");
    expect(byId.get("commercial-access")?.limitation).toContain("One-time checkout");
    expect(byId.get("commercial-access")?.limitation).toContain("direct enterprise checkout");
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
    expect(navigation).toContain("PUBLIC_CAPABILITY_STATUS_LABELS[googleDriveImport.status]");
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

  it("does not publish unverified self-serve prices or conversion claims", () => {
    const source = publicWebsiteSource();

    expect(source).not.toMatch(/\b(?:AED\s*)?(?:149|399|899)\b/i);
    expect(source).not.toMatch(/AED\s*15,?000/i);
    expect(source).not.toMatch(/\bBuy Now\b/i);
    expect(source).not.toMatch(/\bSubscribe\b/i);
    expect(source).not.toMatch(/\bStarter\b[^\n]{0,100}\b1\s+project\b/i);
    expect(source).not.toMatch(/\bProfessional\b[^\n]{0,100}\b5\s+projects\b/i);
    expect(source).not.toMatch(/\bEnterprise\b[^\n]{0,100}\b(?:AED\s*)?15,?000\b/i);
    expect(source).not.toMatch(/\bFull Source Traceability\b/i);
    expect(source).not.toMatch(/\b24\s*\/\s*7 support\b/i);
    expect(source).not.toMatch(/Request Early Access/i);
    expect(source).toContain('t("publicContent.pricing.hero")');
    expect(source).toContain('t("publicContent.home.commercialFaq")');
  });
});
