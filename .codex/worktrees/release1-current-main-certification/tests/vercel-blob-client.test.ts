import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVercelBlobClient } from "../src/lib/storage/vercel-blob-client";

const repoRoot = path.resolve(__dirname, "..");

function listFilesRecursive(dir: string, extension: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("createVercelBlobClient", () => {
  it("throws a safe error (no token value) when BLOB_READ_WRITE_TOKEN is missing", () => {
    const env = { ...process.env };
    delete env.BLOB_READ_WRITE_TOKEN;
    expect(() => createVercelBlobClient(env)).toThrow("BLOB_READ_WRITE_TOKEN is required");
  });

  it("returns a fully-shaped client (put/get/del/head) when a token is present, with no network call", () => {
    const client = createVercelBlobClient({ ...process.env, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test_token_not_real" });
    expect(typeof client.put).toBe("function");
    expect(typeof client.get).toBe("function");
    expect(typeof client.del).toBe("function");
    expect(typeof client.head).toBe("function");
  });

  it("never includes the token in a thrown error message", () => {
    const env = { ...process.env };
    delete env.BLOB_READ_WRITE_TOKEN;
    try {
      createVercelBlobClient(env);
      throw new Error("expected createVercelBlobClient to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toMatch(/vercel_blob_rw_/);
    }
  });

  it("is never imported by a client component (server-only boundary)", () => {
    const srcDir = path.join(repoRoot, "src");
    const files = listFilesRecursive(srcDir, ".tsx");
    const clientFiles = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      return content.startsWith('"use client"') || content.startsWith("'use client'");
    });
    const offenders = clientFiles.filter((file) => {
      const content = readFileSync(file, "utf8");
      return /from ["']@\/lib\/storage\/vercel-blob-client["']/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});
