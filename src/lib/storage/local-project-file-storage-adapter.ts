import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import {
  assertSafeStorageKey,
  type AuthorizedDownload,
  type ByteRange,
  type DocumentStorageAdapter,
  type ObjectMetadata,
  type ObjectStreamResult,
  type PutObjectInput,
  type PutObjectResult,
} from "./document-storage-adapter";

/**
 * Storage for Phase 8 uploaded source files (drawings, schedules, photos,
 * reports) — a physically separate root from generated-document output
 * storage, reusing the same DocumentStorageAdapter interface and
 * path-traversal-safe key resolution as local-document-storage-adapter.ts.
 * Files live under `.storage/project-files/` at the project root, never
 * under `public/`, so nothing here is directly URL-reachable; the only way
 * to read a file back out is through this adapter, reached via authorized
 * routes (tenant + RBAC checked before getObject is ever called).
 */
const STORAGE_ROOT = path.join(process.cwd(), ".storage", "project-files");

function resolvePath(key: string): string {
  assertSafeStorageKey(key);
  const resolved = path.resolve(STORAGE_ROOT, key);
  if (!resolved.startsWith(path.resolve(STORAGE_ROOT) + path.sep)) {
    throw new Error(`Resolved storage path escapes the storage root: ${key}`);
  }
  return resolved;
}

const contentTypeByKey = new Map<string, string>();

export const localProjectFileStorageAdapter: DocumentStorageAdapter = {
  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const filePath = resolvePath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    contentTypeByKey.set(input.key, input.contentType);
    return { key: input.key, size: input.body.byteLength };
  },

  async getObject(key: string): Promise<Buffer> {
    const filePath = resolvePath(key);
    return readFile(filePath);
  },

  async deleteObject(key: string): Promise<void> {
    const filePath = resolvePath(key);
    await rm(filePath, { force: true });
    contentTypeByKey.delete(key);
  },

  async objectExists(key: string): Promise<boolean> {
    try {
      await stat(resolvePath(key));
      return true;
    } catch {
      return false;
    }
  },

  async getMetadata(key: string): Promise<ObjectMetadata | null> {
    try {
      const filePath = resolvePath(key);
      const info = await stat(filePath);
      return {
        key,
        size: info.size,
        contentType: contentTypeByKey.get(key) ?? "application/octet-stream",
        lastModified: info.mtime,
      };
    } catch {
      return null;
    }
  },

  async createAuthorizedDownload(_key: string): Promise<AuthorizedDownload> {
    return { mode: "stream" };
  },

  async getObjectStream(key: string, range?: ByteRange): Promise<ObjectStreamResult> {
    const filePath = resolvePath(key);
    const info = await stat(filePath);
    const contentType = contentTypeByKey.get(key) ?? "application/octet-stream";
    if (range) {
      const end = Math.min(range.end, info.size - 1);
      const nodeStream = createReadStream(filePath, { start: range.start, end });
      return {
        body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        totalSize: info.size,
        contentType,
        servedRange: { start: range.start, end },
      };
    }
    const nodeStream = createReadStream(filePath);
    return { body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, totalSize: info.size, contentType };
  },
};
