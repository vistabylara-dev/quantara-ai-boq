import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static wiring check, not a behavioral test — deliberately so. The actual
 * defect this guards against (document-generation-service.ts hardcoded to
 * the local-filesystem storage adapter, which threw ENOENT on Vercel's
 * read-only serverless bundle) was invisible to every existing behavioral
 * test, because the test environment's own storage provider resolves to
 * "local" either way — the local adapter is correct in tests, it's only
 * wrong in production. Reading the source directly is what actually
 * distinguishes "uses the factory, which happens to return local right
 * now" from "hardcoded to local, period."
 */
const SOURCE_PATH = path.join(process.cwd(), "src/lib/services/document-generation-service.ts");
const source = readFileSync(SOURCE_PATH, "utf-8");
const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("document-generation-service storage wiring", () => {
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

  it("routes generation storage (putObject), secure download (getObject), and deletion (deleteObject) through the resolved adapter", () => {
    expect(sourceWithoutComments).toMatch(/getDocumentStorageAdapter\(\)\.putObject/);
    expect(sourceWithoutComments).toMatch(/getDocumentStorageAdapter\(\)\.getObject/);
    expect(sourceWithoutComments).toMatch(/getDocumentStorageAdapter\(\)\.deleteObject/);
  });
});
