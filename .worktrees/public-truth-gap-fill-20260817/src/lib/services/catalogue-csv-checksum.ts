import { createHash } from "node:crypto";

/**
 * CATALOGUE-INTEGRITY-REPAIR — the master-catalogue CSVs under data-imports/
 * are stored in Git with LF line endings, but a Windows checkout with
 * core.autocrlf=true (or any tool that reads the file through a CRLF-aware
 * text layer) sees CRLF on disk. The original approved checksums in
 * catalogue-dataset-registry.ts were computed against that CRLF-converted
 * local content, not the actual LF bytes Git stores and Vercel's Linux build
 * deploys — so every registered checksum silently disagreed with the real
 * deployed file from day one. This normalizes CRLF -> LF before hashing so
 * the same logical file produces the same checksum on any platform. Only
 * line-ending normalization: no BOM stripping, no whitespace trimming, no
 * row reordering, no encoding changes — a genuine content edit still changes
 * the checksum. Byte-level, not a UTF-8 string round trip, so it never risks
 * corrupting non-UTF-8 bytes.
 *
 * Scoped to catalogue CSV identity only — the generic computeChecksum() in
 * file-security.ts (used for uploaded project files, drawings, etc.) is
 * deliberately untouched; those files are never subject to this cross-
 * platform checkout concern the same way.
 */
export function normalizeLineEndingsToLf(buffer: Buffer): Buffer {
  if (!buffer.includes(0x0d)) return buffer;
  const out = Buffer.allocUnsafe(buffer.length);
  let o = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0x0d && buffer[i + 1] === 0x0a) continue;
    out[o] = byte;
    o += 1;
  }
  return out.subarray(0, o);
}

export function computeCatalogueCsvChecksum(buffer: Buffer): string {
  return createHash("sha256").update(normalizeLineEndingsToLf(buffer)).digest("hex");
}
