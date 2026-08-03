import { createHash, randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors/app-error";

/**
 * Phase 8 section 6 — initial supported file types. DXF/DWG/IFC have no
 * reliable browser-assigned MIME type (browsers commonly send
 * application/octet-stream for all three), so those extensions are trusted
 * on extension alone; every other type is checked against a real MIME
 * allowlist. This is a deliberate, narrower trust boundary than "accept
 * anything" — it never accepts an extension outside this list.
 */
const MIME_BY_EXTENSION: Record<string, readonly string[] | null> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  tif: ["image/tiff"],
  tiff: ["image/tiff"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain", "application/csv"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  dxf: null,
  dwg: null,
  ifc: null,
  // RVT (Revit) and ZIP archives are just as MIME-unreliable across browsers
  // as DXF/DWG/IFC above — trusted on extension alone, same reasoning.
  rvt: null,
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
};

export const SUPPORTED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

/** 200 MB — generous for large drawing-set PDFs and DWG/IFC exports, still bounded. */
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

export type ValidatedUpload = {
  extension: string;
  safeFileName: string;
};

function getExtension(originalName: string): string {
  const parts = originalName.trim().split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

function slugifyBaseName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^./\\]+$/, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || "file";
}

/**
 * Validates extension + MIME + size and returns a collision-proof, path-safe
 * file name. Never trusts the client-supplied name for storage — only for
 * display (originalName is stored separately from safeFileName).
 */
export function validateUpload(originalName: string, mimeType: string, fileSize: number): ValidatedUpload {
  if (fileSize <= 0) {
    throw new AppError("FILE_EMPTY", "The uploaded file is empty.", 400);
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `The uploaded file exceeds the ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB size limit.`,
      400,
    );
  }

  const extension = getExtension(originalName);
  if (!extension || !(extension in MIME_BY_EXTENSION)) {
    throw new AppError(
      "FILE_TYPE_NOT_SUPPORTED",
      `Files with extension ".${extension || "?"}" are not supported. Supported types: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
      400,
    );
  }

  const allowedMimeTypes = MIME_BY_EXTENSION[extension];
  if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType)) {
    throw new AppError(
      "FILE_MIME_MISMATCH",
      `The file's content type ("${mimeType}") does not match its ".${extension}" extension.`,
      400,
    );
  }

  const safeFileName = `${slugifyBaseName(originalName)}-${randomUUID()}.${extension}`;
  return { extension, safeFileName };
}

export function computeChecksum(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export type StorageCategory = "originals" | "previews" | "pages" | "extracted" | "annotations" | "reports";

/** Tenant-scoped, category-namespaced key — matches spec section 5's suggested layout. */
export function buildStorageKey(
  companyId: string,
  projectId: string,
  category: StorageCategory,
  fileName: string,
): string {
  return `companies/${companyId}/projects/${projectId}/${category}/${fileName}`;
}

/**
 * Drawing uploads get their own per-drawing segment (unlike the flat
 * `originals` category above) so every drawing's key is unique even if two
 * drawings share a sanitized file name — the drawingId is generated
 * server-side before this is called, never taken from client input.
 */
export function buildDrawingStorageKey(
  companyId: string,
  projectId: string,
  drawingId: string,
  fileName: string,
): string {
  return `companies/${companyId}/projects/${projectId}/drawings/${drawingId}/${fileName}`;
}
