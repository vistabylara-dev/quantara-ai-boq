import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

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
  return generateClientTokenFromReadWriteToken({
    pathname: input.pathname,
    allowedContentTypes: [input.contentType, "application/octet-stream"],
    maximumSizeInBytes: input.maxSizeBytes,
    validUntil: Date.now() + input.ttlMs,
    allowOverwrite: false,
    addRandomSuffix: false,
  });
}
