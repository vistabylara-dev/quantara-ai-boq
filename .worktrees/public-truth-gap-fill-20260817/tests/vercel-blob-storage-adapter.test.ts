import { describe, expect, it, vi } from "vitest";
import { BlobNotFoundError } from "@vercel/blob";
import { VercelBlobStorageAdapter, VercelBlobStorageError } from "../src/lib/storage/vercel-blob-storage-adapter";

const makeHeaders = (headers: Record<string, string>) => ({
  get: (key: string) => headers[key.toLowerCase()] ?? null,
});

const makeGetResponse = (key: string, content: string) => ({
  statusCode: 200,
  stream: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  }),
  headers: makeHeaders({ "content-type": "text/plain", "content-length": String(content.length) }),
  blob: {
    url: `https://example.com/${key}`,
    downloadUrl: `https://example.com/${key}`,
    pathname: key,
    contentDisposition: "inline",
    cacheControl: "max-age=3600",
    uploadedAt: new Date("2026-08-03T12:00:00.000Z"),
    etag: "etag",
    contentType: "text/plain",
    size: content.length,
  },
});

const makeHeadResponse = (key: string) => ({
  pathname: key,
  contentType: "text/plain",
  contentDisposition: "inline",
  url: `https://example.com/${key}`,
  downloadUrl: `https://example.com/${key}`,
  cacheControl: "max-age=3600",
  uploadedAt: new Date("2026-08-03T12:00:00.000Z"),
  etag: "etag",
  size: 4,
});

describe("VercelBlobStorageAdapter", () => {
  const blobClient = {
    get: vi.fn(async (key: string) => {
      if (key === "exists.txt") {
        return makeGetResponse(key, "test");
      }
      return null;
    }),
    put: vi.fn(async () => ({
      pathname: "test.txt",
      contentType: "text/plain",
      contentDisposition: "inline",
      url: "https://example.com/test.txt",
      downloadUrl: "https://example.com/test.txt",
      cacheControl: "max-age=3600",
      etag: "etag",
      size: 5,
    })),
    del: vi.fn(async () => undefined),
    head: vi.fn(async (key: string) => {
      if (key === "exists.txt") {
        return makeHeadResponse(key);
      }
      throw new BlobNotFoundError();
    }),
  } as any;

  const adapter = new VercelBlobStorageAdapter(blobClient);

  it("putObject succeeds and returns key/size", async () => {
    const result = await adapter.putObject({ key: "test.txt", body: Buffer.from("hello"), contentType: "text/plain" });
    expect(result).toEqual({ key: "test.txt", size: 5 });
    expect(blobClient.put).toHaveBeenCalledWith("test.txt", expect.any(Buffer), {
      access: "private",
      contentType: "text/plain",
      allowOverwrite: false,
    });
  });

  it("getObject returns buffer for existing object", async () => {
    const result = await adapter.getObject("exists.txt");
    expect(result.toString()).toBe("test");
  });

  it("getObject throws for missing object", async () => {
    await expect(adapter.getObject("missing.txt")).rejects.toThrow(VercelBlobStorageError);
  });

  it("deleteObject succeeds for missing object and existing object", async () => {
    await expect(adapter.deleteObject("missing.txt")).resolves.toBeUndefined();
    expect(blobClient.del).toHaveBeenCalledWith("missing.txt");
  });

  it("objectExists returns true only when present", async () => {
    await expect(adapter.objectExists("exists.txt")).resolves.toBe(true);
    await expect(adapter.objectExists("missing.txt")).resolves.toBe(false);
  });

  it("getMetadata returns metadata for existing object", async () => {
    const metadata = await adapter.getMetadata("exists.txt");
    expect(metadata).toMatchObject({ key: "exists.txt", contentType: "text/plain", size: 4 });
    expect(metadata?.lastModified.toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });

  it("getMetadata returns null for missing object", async () => {
    const metadata = await adapter.getMetadata("missing.txt");
    expect(metadata).toBeNull();
  });

  it("createAuthorizedDownload returns stream mode", async () => {
    const result = await adapter.createAuthorizedDownload("exists.txt");
    expect(result).toEqual({ mode: "stream" });
  });

  it("rejects storage keys with path traversal", async () => {
    await expect(adapter.getObject("../etc/passwd")).rejects.toThrow();
    await expect(adapter.putObject({ key: "../etc/passwd", body: Buffer.from("x"), contentType: "text/plain" })).rejects.toThrow();
  });
});
