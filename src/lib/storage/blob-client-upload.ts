import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { AppError } from "@/lib/errors/app-error";

/**
 * CORE-FLOW-1 — server-only. Generates a short-lived Vercel Blob client
 * token scoped to one exact pathname, so the browser can PUT the file bytes
 * directly to private Blob storage without ever routing them through a
 * Vercel serverless function. Never returns BLOB_READ_WRITE_TOKEN itself —
 * only the derived, constrained client token, which is useless outside the
 * declared pathname/size/content-type/expiry it was issued for.
 */
export type ClientUploadTokenInput = {
  pathname: string;
  contentType: string;
  maxSizeBytes: number;
  ttlMs: number;
};

export async function generateDrawingUploadToken(input: ClientUploadTokenInput): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new AppError(
      "DIRECT_UPLOAD_NOT_CONFIGURED",
      "Drawing upload storage is not configured. Contact your administrator before retrying.",
      503,
    );
  }
  return generateClientTokenFromReadWriteToken({
    pathname: input.pathname,
    // The drawing service has already validated the declared MIME against
    // the filename extension. Do not widen this capability after validation:
    // Blob must accept only that exact authorized content type.
    allowedContentTypes: [input.contentType],
    maximumSizeInBytes: input.maxSizeBytes,
    validUntil: Date.now() + input.ttlMs,
    allowOverwrite: false,
    addRandomSuffix: false,
  });
}
