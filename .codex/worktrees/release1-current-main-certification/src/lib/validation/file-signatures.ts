/**
 * Byte-signature checks used to stop a file being handed to the wrong parser
 * based on client-supplied metadata alone (filename/declared type are both
 * attacker- and user-controllable). A PDF renamed or mis-tagged as XLSX must
 * never reach the spreadsheet parser — see import-service.ts's use of
 * assertLooksLikeSpreadsheet, added after a production PDF was misrouted
 * through the CSV/XLSX import and surfaced a spreadsheet-specific parse
 * error for a file that was never a spreadsheet.
 */

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
// XLSX (and any modern Office Open XML file) is a ZIP archive. PK\x03\x04 is
// the standard local-file-header signature; PK\x05\x06 is the (rarer) empty
// -archive end-of-central-directory signature.
const ZIP_SIGNATURE_1 = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_SIGNATURE_2 = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

export function looksLikeZip(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4);
  return head.equals(ZIP_SIGNATURE_1) || head.equals(ZIP_SIGNATURE_2);
}
