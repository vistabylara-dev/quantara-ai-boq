import { del, get, head, put } from "@vercel/blob";
import type { VercelBlobClient } from "./vercel-blob-storage-adapter";

/**
 * Thin binder from the official @vercel/blob top-level functions to the
 * VercelBlobClient shape VercelBlobStorageAdapter expects. Never returns,
 * logs, or exposes the token — it is only closed over and forwarded to the
 * SDK's own `token` option on each call. Server-only by construction: this
 * module is never imported by a "use client" file (enforced by a source-scan
 * test), and constructing the client here makes no network call — only the
 * bound put/get/del/head calls do, when actually invoked.
 */
export function createVercelBlobClient(env: typeof process.env = process.env): VercelBlobClient {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to use STORAGE_PROVIDER=vercel-blob.");
  }

  return {
    put: (pathname, body, options) => put(pathname, body, { ...options, token }),
    get: (pathname, options) => get(pathname, { ...options, token }),
    del: (pathnames, options) => del(pathnames, { ...options, token }),
    head: (pathname) => head(pathname, { token }),
  };
}
