import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITIES,
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
      "Quantara is AI-assisted BOQ workflow software for construction professionals.",
    );
    expect(QUANTARA_WORKFLOW_TRUTH).toBe(
      "Quantara helps construction professionals move from supported project sources through reviewed extraction, dimensions, visible calculations, BOQ organization, review and validation to professional outputs. Quantara assists the professional; it does not replace professional judgement.",
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
    expect(byId.get("typed-multi-change-proposals")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("visible-calculations")?.status).toBe("LIMITED");
    expect(byId.get("source-attribution")?.status).toBe("LIMITED");
    expect(byId.get("google-drive-import")?.status).toBe("CONTROLLED_ACCESS");
    expect(byId.get("voice-proposals")?.status).toBe("CONTROLLED_ACCESS");
    expect(byId.get("commercial-access")?.status).toBe("CONTROLLED_ACCESS");
    expect(byId.get("commercial-access")?.name).toBe("Commercial access review");
    expect(byId.get("commercial-access")?.limitation).toContain("not an activated billing");
    expect(byId.get("self-service-billing")?.status).toBe("NOT_AVAILABLE");
    expect(byId.get("self-service-billing")?.summary).toContain("does not currently offer public checkout");
    expect(byId.get("professional-outputs")?.summary).toContain("stored BOQ and project data");
    expect(byId.get("professional-outputs")?.limitation).toMatch(/draft or otherwise unreviewed/i);
    expect(byId.get("document-templates")?.summary).toContain("stored BOQ records");
    expect(byId.get("technical-report-generation")?.summary).toContain("stored project records");
    expect(byId.get("technical-report-generation")?.limitation).toContain("unreviewed records");
    expect(byId.get("technical-report-generation")?.status).toBe("LIMITED");
    expect(byId.get("model-file-import")?.status).toBe("NOT_AVAILABLE");
    expect(OCR_IMPLEMENTATION_STATUS).toBe("NOT_IMPLEMENTED");
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
    expect(seoTemplate).toContain("getPublicStatus(feature.capabilityId)");
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
    expect(source).not.toMatch(/Durable production storage is confirmed/i);
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
    expect(source).toContain("Controlled Early Access");
    expect(source).toContain("does not currently offer public self-service subscription plans or checkout");
  });

  it("does not expose internal editorial instructions or imply output review is enforced", () => {
    const source = publicWebsiteSource();

    expect(source).not.toContain("Do not name specific providers unless they have been verified");
    expect(source).not.toMatch(/structured, contract-ready documents/i);
    expect(source).not.toMatch(/generate(?:d)?[^.\n]{0,100}from reviewed (?:BOQ |project )?(?:data|records)/i);
    expect(source).toMatch(/draft or (?:otherwise )?unreviewed records/i);
  });
});
