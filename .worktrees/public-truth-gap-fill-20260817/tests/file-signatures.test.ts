import { describe, expect, it } from "vitest";
import { looksLikePdf, looksLikeZip } from "../src/lib/validation/file-signatures";

describe("file-signatures", () => {
  it("detects a real PDF signature", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.4\n..."))).toBe(true);
  });

  it("does not misidentify plain text as a PDF", () => {
    expect(looksLikePdf(Buffer.from("Code,Name,Unit,Cost\nA-1,Item,nos,10"))).toBe(false);
  });

  it("does not misidentify a ZIP/XLSX as a PDF", () => {
    expect(looksLikePdf(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe(false);
  });

  it("detects a ZIP/XLSX local-file-header signature", () => {
    expect(looksLikeZip(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe(true);
  });

  it("detects a ZIP empty-archive signature", () => {
    expect(looksLikeZip(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]))).toBe(true);
  });

  it("does not misidentify a PDF as a ZIP", () => {
    expect(looksLikeZip(Buffer.from("%PDF-1.4\n..."))).toBe(false);
  });

  it("handles empty and short buffers without throwing", () => {
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
    expect(looksLikeZip(Buffer.from([0x50]))).toBe(false);
  });
});
