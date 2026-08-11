import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static wiring check, not a behavioral test — deliberately so. The actual
 * defect this guards against (a generated-document service hardcoded to the
 * local-filesystem storage adapter, which throws on Vercel's read-only
 * serverless bundle) is invisible to every existing behavioral test, because
 * the test environment's own storage provider resolves to "local" either way
 * — the local adapter is correct in tests, it's only wrong in production.
 * Reading the source directly is what actually distinguishes "uses the
 * factory, which happens to return local right now" from "hardcoded to
 * local, period."
 *
 * P0-SOURCE-STORAGE-READ — originally written for document-generation-
 * service.ts only (BOQ documents). Extended to cover
 * technical-report-service.ts, public-technical-report-service.ts, and
 * public-proposal-service.ts after a fresh production run
 * (2026-08-11) reproduced the identical bug in technical-report-service.ts:
 * generateReportDocument()'s putObject() call threw on Vercel's read-only
 * filesystem, surfacing as a 500 TECHNICAL_REPORT_GENERATION_FAILED. The two
 * public-*-service.ts files read bytes back through the same hardcoded local
 * adapter and would have failed identically on the client-facing download
 * path even after the write-side fix, since the file is actually written to
 * Blob storage in production.
 */
const SERVICE_FILES = [
  "src/lib/services/document-generation-service.ts",
  "src/lib/services/technical-report-service.ts",
  "src/lib/services/public-technical-report-service.ts",
  "src/lib/services/public-proposal-service.ts",
] as const;

describe.each(SERVICE_FILES)("%s storage wiring", (relativePath) => {
  const source = readFileSync(path.join(process.cwd(), relativePath), "utf-8");
  const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("does not import local-document-storage-adapter", () => {
    expect(source).not.toMatch(/from\s*["']@\/lib\/storage\/local-document-storage-adapter["']/);
  });

  it("does not reference the localDocumentStorageAdapter identifier anywhere in real code (comments may still describe the concept in prose)", () => {
    expect(sourceWithoutComments).not.toMatch(/\blocalDocumentStorageAdapter\b/);
  });

  it("imports createStorageAdapter and resolveStorageProvider from the storage factory", () => {
    expect(source).toMatch(/import\s*\{\s*createStorageAdapter\s*,\s*resolveStorageProvider\s*\}\s*from\s*["']@\/lib\/storage\/storage-factory["']/);
  });

  it("resolves storage for the generated-documents purpose", () => {
    expect(source).toMatch(/purpose:\s*["']generated-documents["']/);
  });

  it("routes every storage call actually present in this file through the resolved adapter, never the raw import", () => {
    for (const method of ["putObject", "getObject", "deleteObject"] as const) {
      const totalCalls = sourceWithoutComments.match(new RegExp(`\\.${method}\\(`, "g")) ?? [];
      const qualifiedCalls = sourceWithoutComments.match(new RegExp(`getDocumentStorageAdapter\\(\\)\\.${method}\\(`, "g")) ?? [];
      // Every call to this method must be qualified through the adapter — a file with one
      // correct call and one leftover raw/hardcoded call would otherwise slip through, since
      // the previous version only checked that a qualified call existed *somewhere*.
      expect(qualifiedCalls.length).toBe(totalCalls.length);
    }
    // At least one storage operation must actually be present — otherwise this file has no
    // business importing the storage factory at all, and the check above would be vacuous.
    const usesAnyStorageMethod = /\.(putObject|getObject|deleteObject)\(/.test(sourceWithoutComments);
    expect(usesAnyStorageMethod).toBe(true);
  });
});
