import { AppError } from "@/lib/errors/app-error";
import { DRAWING_EXTENSIONS as DRAWING_UPLOAD_EXTENSIONS } from "@/lib/validation/drawing-schema";

export const STRUCTURED_SOURCE_EXTENSIONS = ["csv", "xlsx", "docx"] as const;
export const STRUCTURED_SOURCE_ACCEPT = STRUCTURED_SOURCE_EXTENSIONS.map((extension) => `.${extension}`).join(",");
export const PROJECT_SOURCE_EXTENSIONS = [...DRAWING_UPLOAD_EXTENSIONS, ...STRUCTURED_SOURCE_EXTENSIONS] as const;
export const PROJECT_SOURCE_ACCEPT = PROJECT_SOURCE_EXTENSIONS.map((extension) => `.${extension}`).join(",");

/**
 * Buffered project-source uploads must stay below the smallest production
 * function request-body limit used by this application. The 4 MiB file limit
 * plus 64 KiB of multipart overhead is 4,259,840 bytes in total, below the
 * deployed 4.5 MB Function request ceiling.
 */
export const STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
export const STRUCTURED_SOURCE_MAX_REQUEST_SIZE_BYTES = STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES + (64 * 1024);

export const STRUCTURED_SOURCE_FILENAME_HEADER = "x-quantara-upload-filename";
export const STRUCTURED_SOURCE_SIZE_HEADER = "x-quantara-upload-size";

const MIME_BY_EXTENSION: Record<(typeof STRUCTURED_SOURCE_EXTENSIONS)[number], readonly string[]> = {
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain", "application/csv"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const DRAWING_EXTENSION_SET = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "tif",
  "tiff",
  "dxf",
  "dwg",
  "ifc",
  "rvt",
  "zip",
]);

export type StructuredSourceUploadMetadata = {
  originalName: string;
  declaredByteSize: number;
};

function getExtension(originalName: string): string {
  const parts = originalName.trim().split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

function structuredSourceOnlyError(extension: string): AppError {
  if (DRAWING_EXTENSION_SET.has(extension)) {
    return new AppError(
      "DRAWING_UPLOAD_ROUTE_REQUIRED",
      "PDF and drawing files must be uploaded through Drawing Intake.",
      415,
    );
  }

  return new AppError(
    "STRUCTURED_SOURCE_TYPE_NOT_SUPPORTED",
    "Source Processing accepts CSV, XLSX, and DOCX files only. Upload PDFs and drawings through Drawing Intake.",
    415,
  );
}

function parseBoundedInteger(value: string | null, code: string, message: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new AppError(code, message, 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AppError(code, message, 400);
  }
  return parsed;
}

export function validateStructuredSourceUpload(
  originalName: string,
  mimeType: string,
  fileSize: number,
): { extension: (typeof STRUCTURED_SOURCE_EXTENSIONS)[number] } {
  const normalizedName = originalName.trim();
  if (!normalizedName || normalizedName.length > 255 || /[\u0000-\u001f\u007f]/.test(normalizedName)) {
    throw new AppError("UPLOAD_FILENAME_INVALID", "The uploaded file name is invalid.", 400);
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new AppError("FILE_EMPTY", "The uploaded file is empty.", 400);
  }
  if (fileSize > STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      "CSV, XLSX, and DOCX uploads are limited to 4 MB. Large PDFs and drawings must use Drawing Intake.",
      413,
    );
  }

  const extension = getExtension(normalizedName);
  if (!STRUCTURED_SOURCE_EXTENSIONS.includes(extension as (typeof STRUCTURED_SOURCE_EXTENSIONS)[number])) {
    throw structuredSourceOnlyError(extension);
  }

  const structuredExtension = extension as (typeof STRUCTURED_SOURCE_EXTENSIONS)[number];
  if (!MIME_BY_EXTENSION[structuredExtension].includes(mimeType)) {
    throw new AppError(
      "FILE_MIME_MISMATCH",
      `The file's content type does not match its ".${structuredExtension}" extension.`,
      400,
    );
  }

  return { extension: structuredExtension };
}

/**
 * Validates only request metadata, so disallowed and oversized requests are
 * rejected before Next.js parses or buffers multipart bytes.
 */
export function preflightProjectSourceRequest(
  headers: Headers,
  isProduction: boolean,
): StructuredSourceUploadMetadata | null {
  const contentType = headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new AppError("MULTIPART_REQUIRED", "A multipart file upload is required.", 415);
  }

  // Local/test preserves the original general uploader contract, including
  // headerless clients and every extension supported by file-security.ts.
  // Its service-level 200 MB limit remains the authoritative bound.
  if (!isProduction) return null;

  // Content-Length is controlled by the browser/transport and can be omitted
  // or normalized by an HTTP/2 proxy. Enforce it when present, but do not make
  // a valid upload depend on a header application code cannot guarantee.
  const rawContentLength = headers.get("content-length");
  const contentLength = rawContentLength === null
    ? null
    : parseBoundedInteger(
      rawContentLength,
      "CONTENT_LENGTH_INVALID",
      "The source upload Content-Length header is invalid.",
    );
  if (contentLength !== null && contentLength > STRUCTURED_SOURCE_MAX_REQUEST_SIZE_BYTES) {
    throw new AppError(
      "REQUEST_TOO_LARGE",
      "The source upload request is too large. CSV, XLSX, and DOCX files are limited to 4 MB.",
      413,
    );
  }

  const encodedName = headers.get(STRUCTURED_SOURCE_FILENAME_HEADER);
  const rawDeclaredSize = headers.get(STRUCTURED_SOURCE_SIZE_HEADER);

  // Production cannot distinguish a headerless structured source from a PDF
  // without parsing multipart bytes. Fail closed before formData(); legacy
  // headerless compatibility is deliberately local/test-only above.
  if (encodedName === null && rawDeclaredSize === null) {
    throw new AppError(
      "UPLOAD_METADATA_REQUIRED",
      "This production upload requires filename and size metadata. Refresh Source Processing or use Drawing Intake for PDF and drawing files.",
      400,
    );
  }

  const declaredSize = parseBoundedInteger(
    rawDeclaredSize,
    "UPLOAD_METADATA_REQUIRED",
    "This upload request is missing required metadata. Refresh Source Processing for CSV, XLSX, or DOCX, or use Drawing Intake for PDF and drawing files.",
  );
  if (!encodedName || encodedName.length > 1_024) {
    throw new AppError(
      "UPLOAD_METADATA_REQUIRED",
      "This upload request is missing required metadata. Refresh Source Processing for CSV, XLSX, or DOCX, or use Drawing Intake for PDF and drawing files.",
      400,
    );
  }

  let originalName: string;
  try {
    originalName = decodeURIComponent(encodedName);
  } catch {
    throw new AppError("UPLOAD_METADATA_INVALID", "The upload metadata is invalid.", 400);
  }

  // Use the declared filename to reject legacy/manual PDF and drawing posts
  // before request.formData() can buffer their bodies.
  const extension = getExtension(originalName);
  if (!STRUCTURED_SOURCE_EXTENSIONS.includes(extension as (typeof STRUCTURED_SOURCE_EXTENSIONS)[number])) {
    throw structuredSourceOnlyError(extension);
  }

  if (declaredSize > STRUCTURED_SOURCE_MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      "CSV, XLSX, and DOCX uploads are limited to 4 MB. Large PDFs and drawings must use Drawing Intake.",
      413,
    );
  }
  if (declaredSize <= 0 || (contentLength !== null && contentLength < declaredSize)) {
    throw new AppError("UPLOAD_METADATA_INVALID", "The upload size metadata is invalid.", 400);
  }

  return { originalName, declaredByteSize: declaredSize };
}

/** Backward-compatible name for callers that specifically require the production structured-source preflight. */
export function preflightStructuredSourceRequest(headers: Headers): StructuredSourceUploadMetadata | null {
  return preflightProjectSourceRequest(headers, true);
}

function startsWithAscii(bytes: Uint8Array, value: string): boolean {
  if (bytes.byteLength < value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

/** Defense in depth against a PDF or common drawing/image payload renamed as a structured source. */
export function assertNoDrawingSignature(bytes: Uint8Array): void {
  const isPdf = startsWithAscii(bytes, "%PDF-");
  const isDwg = startsWithAscii(bytes, "AC10");
  const isIfc = startsWithAscii(bytes, "ISO-10303-21");
  const isPng = bytes.byteLength >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isTiff = bytes.byteLength >= 4
    && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
      || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a));

  if (isPdf || isDwg || isIfc || isPng || isJpeg || isTiff) {
    throw new AppError(
      "DRAWING_UPLOAD_ROUTE_REQUIRED",
      "PDF and drawing files must be uploaded through Drawing Intake.",
      415,
    );
  }
}
