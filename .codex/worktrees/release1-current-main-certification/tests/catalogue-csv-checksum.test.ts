import { describe, expect, it } from "vitest";
import { computeChecksum } from "../src/lib/files/file-security";
import { computeCatalogueCsvChecksum, normalizeLineEndingsToLf } from "../src/lib/services/catalogue-csv-checksum";

/**
 * CATALOGUE-INTEGRITY-REPAIR — proves the exact defect (approved checksums
 * computed against CRLF-converted local content while Git/Vercel always
 * serve LF) can never recur: the same logical CSV must produce the same
 * canonical checksum whether its line endings are LF or CRLF, and a real
 * content change must still change the checksum.
 */
describe("computeCatalogueCsvChecksum", () => {
  const lfCsv = "itemCode,discipline,description\nA-001,mechanical,Test item\nA-002,mechanical,Second item\n";
  const crlfCsv = lfCsv.replace(/\n/g, "\r\n");

  it("produces the identical checksum for the same content in LF and CRLF form", () => {
    const lfChecksum = computeCatalogueCsvChecksum(Buffer.from(lfCsv, "utf-8"));
    const crlfChecksum = computeCatalogueCsvChecksum(Buffer.from(crlfCsv, "utf-8"));
    expect(lfChecksum).toBe(crlfChecksum);
  });

  it("changes the checksum when a real content character changes (not just line endings)", () => {
    const baseline = computeCatalogueCsvChecksum(Buffer.from(lfCsv, "utf-8"));
    const edited = lfCsv.replace("Second item", "Second Item"); // one real character changed
    const editedChecksum = computeCatalogueCsvChecksum(Buffer.from(edited, "utf-8"));
    expect(editedChecksum).not.toBe(baseline);
  });

  it("changes the checksum when a row is added or removed", () => {
    const baseline = computeCatalogueCsvChecksum(Buffer.from(lfCsv, "utf-8"));
    const withExtraRow = computeCatalogueCsvChecksum(Buffer.from(`${lfCsv}A-003,mechanical,Third item\n`, "utf-8"));
    expect(withExtraRow).not.toBe(baseline);
  });

  it("only normalizes CRLF -> LF, leaving a lone CR (old Mac style) untouched", () => {
    const lonelyCr = "a,b\rc,d\r"; // bare CR, not CRLF — must not be altered
    const normalized = normalizeLineEndingsToLf(Buffer.from(lonelyCr, "binary"));
    expect(normalized.toString("binary")).toBe(lonelyCr);
  });

  it("does not strip a BOM or alter non-line-ending bytes", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const withBom = Buffer.concat([bom, Buffer.from(lfCsv, "utf-8")]);
    const normalized = normalizeLineEndingsToLf(withBom);
    expect(normalized.subarray(0, 3).equals(bom)).toBe(true);
  });

  it("leaves an already-LF buffer byte-identical (fast path, no unnecessary copy)", () => {
    const buffer = Buffer.from(lfCsv, "utf-8");
    const normalized = normalizeLineEndingsToLf(buffer);
    expect(normalized.equals(buffer)).toBe(true);
  });

  it("the generic computeChecksum() used elsewhere in the app is untouched — still raw, platform-sensitive bytes", () => {
    const lfHash = computeChecksum(Buffer.from(lfCsv, "utf-8"));
    const crlfHash = computeChecksum(Buffer.from(crlfCsv, "utf-8"));
    // The whole point: the generic function must still disagree on CRLF vs LF —
    // only the catalogue-specific canonical function is allowed to normalize.
    expect(lfHash).not.toBe(crlfHash);
  });
});
