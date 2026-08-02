/**
 * Storage abstraction for generated document files (CSV/XLSX/PDF/DOCX/HTML).
 *
 * This is intentionally separate from the pre-existing `storage-adapter.ts` /
 * `local-storage-adapter.ts` in this same directory, which are unrelated
 * legacy client-side localStorage adapters for demo project/BOQ/catalogue
 * state (consumed only by the dead `src/store/*` Zustand stores, which no
 * app page imports). Reusing those names would have silently repurposed
 * unrelated dead code instead of building the file-storage abstraction this
 * phase actually needs, so this is a new, non-colliding pair of files.
 */

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type PutObjectResult = {
  key: string;
  size: number;
};

export type ObjectMetadata = {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
};

/**
 * Local storage has no real signed-URL concept, so `createAuthorizedDownload`
 * returns a discriminated result: local implementations return `{mode:
 * "stream"}` and the caller (the download API route) fetches the bytes
 * itself via `getObject` after performing its own tenant/RBAC checks. A
 * future S3/R2-backed adapter would instead return `{mode: "redirect", url}`
 * with a short-lived presigned GET URL, and the download route would 302 to
 * it without ever streaming bytes through the Node process.
 */
export type AuthorizedDownload = { mode: "stream" } | { mode: "redirect"; url: string };

export type DocumentStorageAdapter = {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<ObjectMetadata | null>;
  createAuthorizedDownload(key: string): Promise<AuthorizedDownload>;
};

export class StorageKeyError extends Error {
  constructor(key: string) {
    super(`Unsafe or invalid storage key: ${key}`);
    this.name = "StorageKeyError";
  }
}

/**
 * Storage keys are always constructed server-side (never taken verbatim from
 * client input), but this is validated defensively anyway: no path
 * traversal segments, no absolute paths, no backslashes, no null bytes.
 */
export function assertSafeStorageKey(key: string): void {
  if (
    !key ||
    key.includes("\0") ||
    key.includes("\\") ||
    key.startsWith("/") ||
    key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new StorageKeyError(key);
  }
}
