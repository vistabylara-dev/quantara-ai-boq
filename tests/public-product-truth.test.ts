import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITIES,
  QUANTARA_ENTITY_DEFINITION,
  QUANTARA_WORKFLOW_TRUTH,
} from "@/lib/public-site/product-truth";

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
    expect(byId.get("commercial-access")?.limitation).toContain("does not offer verified self-serve");
  });

  it("does not publish unverified self-serve prices or conversion claims", () => {
    const source = publicWebsiteSource();

    expect(source).not.toMatch(/\b(?:AED\s*)?(?:149|399|899)\b/i);
    expect(source).not.toMatch(/AED\s*15,?000/i);
    expect(source).not.toMatch(/\bBuy Now\b/i);
    expect(source).not.toMatch(/\bSubscribe\b/i);
  });
});
