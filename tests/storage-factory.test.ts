import { describe, expect, it } from "vitest";
import { createStorageAdapter, resolveStorageProvider, type StorageProvider } from "../src/lib/storage/storage-factory";
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

describe("resolveStorageProvider", () => {
  // Every case builds its own isolated env object literal — resolveStorageProvider
  // takes an explicit env parameter for exactly this reason, so no test here ever
  // reads or mutates the real process.env.

  it("throws in production when STORAGE_PROVIDER is missing (this is the exact regression that let generated-document storage silently fall back to a local-filesystem adapter that doesn't work on Vercel)", () => {
    const env = { NODE_ENV: "production" } as unknown as typeof process.env;
    expect(() => resolveStorageProvider(env)).toThrow("Missing STORAGE_PROVIDER in production");
  });

  it("throws in production when STORAGE_PROVIDER=local", () => {
    const env = { NODE_ENV: "production", STORAGE_PROVIDER: "local" } as unknown as typeof process.env;
    expect(() => resolveStorageProvider(env)).toThrow("STORAGE_PROVIDER=local is not allowed in production");
  });

  it("resolves to vercel-blob in production when STORAGE_PROVIDER=vercel-blob", () => {
    const env = { NODE_ENV: "production", STORAGE_PROVIDER: "vercel-blob" } as unknown as typeof process.env;
    expect(resolveStorageProvider(env)).toBe("vercel-blob");
  });

  it("resolves to local outside production when STORAGE_PROVIDER is missing", () => {
    const env = { NODE_ENV: "test" } as unknown as typeof process.env;
    expect(resolveStorageProvider(env)).toBe("local");
  });
});
