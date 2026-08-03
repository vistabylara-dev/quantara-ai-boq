import { describe, expect, it } from "vitest";
import { createStorageAdapter, type StorageProvider } from "../src/lib/storage/storage-factory";
import { localDocumentStorageAdapter } from "../src/lib/storage/local-document-storage-adapter";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";
import { VercelBlobStorageAdapter } from "../src/lib/storage/vercel-blob-storage-adapter";

const dummyBlobClient = {
  bucket: { name: "dummy" },
  get: async () => ({ ok: false, status: 404, statusText: "Not Found", headers: new Map<string, string>() as any, arrayBuffer: async () => new ArrayBuffer(0) }),
  put: async () => ({ ok: true, status: 200, statusText: "OK" }),
  delete: async () => ({ ok: true, status: 200, statusText: "OK" }),
} as any;

describe("storage factory", () => {
  it("returns the local generated-document adapter for local/generated-documents", () => {
    const adapter = createStorageAdapter({ provider: "local", purpose: "generated-documents" });
    expect(adapter).toBe(localDocumentStorageAdapter);
  });

  it("returns the local project-file adapter for local/project-files", () => {
    const adapter = createStorageAdapter({ provider: "local", purpose: "project-files" });
    expect(adapter).toBe(localProjectFileStorageAdapter);
  });

  it("returns a VercelBlobStorageAdapter for vercel-blob", () => {
    const adapter = createStorageAdapter({ provider: "vercel-blob", vercelBlobClient: dummyBlobClient, purpose: "generated-documents" });
    expect(adapter).toBeInstanceOf(VercelBlobStorageAdapter);
  });

  it("throws for unsupported provider", () => {
    expect(() => createStorageAdapter({ provider: "unsupported" as StorageProvider, purpose: "generated-documents" })).toThrow("Unsupported STORAGE_PROVIDER");
  });

  it("throws when no client is injected and BLOB_READ_WRITE_TOKEN is missing", () => {
    const env = { ...process.env };
    delete env.BLOB_READ_WRITE_TOKEN;
    expect(() =>
      createStorageAdapter({ provider: "vercel-blob", purpose: "project-files", env }),
    ).toThrow("BLOB_READ_WRITE_TOKEN is required");
  });

  it("auto-constructs a real client when no client is injected but a token is present (no network call)", () => {
    const env = { ...process.env, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test_token_not_real" };
    const adapter = createStorageAdapter({ provider: "vercel-blob", purpose: "project-files", env });
    expect(adapter).toBeInstanceOf(VercelBlobStorageAdapter);
  });
});
