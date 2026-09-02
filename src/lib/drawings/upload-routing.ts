/**
 * Pure decision logic for the drawing-upload client (page.tsx), split out so
 * the "PDF bytes never pass through a Vercel Function in production"
 * invariant (CORE-FLOW-1) can be unit tested without a browser.
 *
 * This exists because of a real regression: an earlier change added an
 * unconditional file-size branch that routed every drawing under 3MB through
 * the legacy server-buffered POST /drawings route in every environment,
 * including production — silently reintroducing the multipart upload path
 * CORE-FLOW-1 was built to eliminate. The only legitimate reason to use the
 * buffered route is local development without STORAGE_PROVIDER=vercel-blob
 * configured; it must never be a size-based choice, and never available in
 * production even as a fallback.
 */

/** The exact substring of the AppError message authorizeDrawingUpload throws when this environment has no direct-upload storage configured. */
export const DIRECT_UPLOAD_CONFIG_ERROR_MARKER = "STORAGE_PROVIDER=vercel-blob";

/**
 * True only when: (1) authorization failed specifically because direct
 * upload isn't configured in this environment, and (2) this is not
 * production. In production, every authorization failure — including a
 * missing BLOB_READ_WRITE_TOKEN — must surface as a real, visible
 * configuration error to the user, never a silent fallback to a path that
 * would route PDF bytes through a Vercel Function.
 */
export function shouldFallBackToBufferedUpload(errorMessage: string, isProduction: boolean): boolean {
  return !isProduction && errorMessage.includes(DIRECT_UPLOAD_CONFIG_ERROR_MARKER);
}
