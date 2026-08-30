import path from "node:path";
import PDFDocument from "pdfkit";
import type { CanonicalDocumentData } from "../build-document-data";
import type { DocumentTemplateContentConfig, DocumentTemplateStyleConfig } from "../template-config";
import { isArabicChar, splitScriptRuns, toVisualArabic } from "../arabic-text";
import { fitLogoBox, loadLogoImage } from "../logo-image";

function containsArabic(text: string): boolean {
  for (const char of text) {
    if (isArabicChar(char)) return true;
  }
  return false;
}

const ARABIC_REGULAR_PATH = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff",
);
const ARABIC_BOLD_PATH = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff",
);

const PAGE_MARGIN = 48;
const CONTENT_BOTTOM = 793.7; // A4 height (841.89) minus bottom margin, leaving room for the footer

type FontSet = { regular: string; bold: string };

type Column = { key: string; label: string; width: number; align?: "left" | "right" | "center" };

function hexToRgbArray(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Word-wraps logical (unshaped) text to fit `width`, measuring each candidate line after shaping. */
function wrapArabicText(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number, fonts: FontSet): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureVisualWidth(doc, toVisualArabic(candidate), fontSize, fonts) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function measureVisualWidth(doc: PDFKit.PDFDocument, visualText: string, fontSize: number, fonts: FontSet): number {
  doc.fontSize(fontSize);
  let total = 0;
  for (const run of splitScriptRuns(visualText)) {
    doc.font(run.arabic ? fonts.regular : "Helvetica");
    total += doc.widthOfString(run.text);
  }
  return total;
}

/** Draws one already visually-reordered line, switching fonts per script run, aligned within [x, x+width]. */
function drawVisualLine(
  doc: PDFKit.PDFDocument,
  visualText: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  fonts: FontSet,
  bold: boolean,
  align: "left" | "right" | "center",
): void {
  const runs = splitScriptRuns(visualText);
  const arabicFont = bold ? fonts.bold : fonts.regular;
  doc.fontSize(fontSize);
  let total = 0;
  for (const run of runs) {
    doc.font(run.arabic ? arabicFont : bold ? "Helvetica-Bold" : "Helvetica");
    total += doc.widthOfString(run.text);
  }
  let cursorX = x;
  if (align === "right") cursorX = x + width - total;
  else if (align === "center") cursorX = x + (width - total) / 2;
  for (const run of runs) {
    doc.font(run.arabic ? arabicFont : bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(run.text, cursorX, y, { lineBreak: false });
    cursorX += doc.widthOfString(run.text);
  }
}

/**
 * Draws shaped, word-wrapped text inside a box and returns the height used.
 * Used both for RTL-template paragraphs (right-aligned by default) and for
 * LTR-template text that happens to contain embedded Arabic characters
 * (left-aligned, matching how the surrounding paragraph would flow) — a
 * plain-Helvetica pdfkit render of untranslated Arabic bytes produces
 * mojibake rather than missing-glyph boxes, so any string containing Arabic
 * must go through this path regardless of the template's own direction.
 */
function drawShapedBlock(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  fonts: FontSet,
  bold: boolean,
  align: "left" | "right" | "center",
): number {
  const lineHeight = fontSize * 1.35;
  const lines = wrapArabicText(doc, text, width, fontSize, fonts);
  lines.forEach((line, index) => {
    drawVisualLine(doc, toVisualArabic(line), x, y + index * lineHeight, width, fontSize, fonts, bold, align);
  });
  return Math.max(lines.length, 1) * lineHeight;
}

function formatCurrency(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type GeneratePdfInput = {
  data: CanonicalDocumentData;
  style: DocumentTemplateStyleConfig;
  content: DocumentTemplateContentConfig;
};

/**
 * Renders the canonical document data to a real, non-browser-generated PDF
 * via pdfkit. RTL (Arabic Formal) documents shape and bidi-reorder text
 * themselves (see arabic-text.ts) since pdfkit performs no text shaping —
 * everything else uses pdfkit's built-in Helvetica and plain LTR layout.
 */
export async function generatePdf(input: GeneratePdfInput): Promise<Buffer> {
  const { data, style, content } = input;
  const rtl = style.direction === "rtl";
  const [pr, pg, pb] = hexToRgbArray(style.primaryColor);
  const [ar, ag, ab] = hexToRgbArray(style.accentColor);

  const logo = await loadLogoImage(data.company.logoUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    function drawLogoSafely(x: number, y: number, maxWidth: number, maxHeight: number): number {
      if (!logo) return 0;
      try {
        const box = fitLogoBox(logo.width, logo.height, maxWidth, maxHeight);
        doc.image(logo.buffer, x, y, { width: box.width, height: box.height });
        return box.height;
      } catch {
        return 0;
      }
    }

    // Registered unconditionally: even an LTR/Helvetica-only template can
    // encounter a description or note containing Arabic characters, and
    // Helvetica has no Arabic glyphs to fall back on.
    doc.registerFont("Arabic", ARABIC_REGULAR_PATH);
    doc.registerFont("Arabic-Bold", ARABIC_BOLD_PATH);
    const fonts: FontSet = { regular: "Arabic", bold: "Arabic-Bold" };
    const pageWidth = doc.page ? doc.page.width : 595.28;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;

    function writeText(str: string, x: number, y: number, width: number, opts: { bold?: boolean; size?: number; align?: "left" | "right" | "center"; color?: [number, number, number] } = {}) {
      const size = opts.size ?? 10;
      const color = opts.color ?? [15, 23, 42];
      doc.fillColor(color);
      const defaultAlign = rtl ? "right" : "left";
      if (rtl || containsArabic(str)) {
        drawShapedBlock(doc, str, x, y, width, size, fonts, Boolean(opts.bold), opts.align ?? defaultAlign);
      } else {
        doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).text(str, x, y, { width, align: opts.align ?? defaultAlign });
      }
      doc.fillColor("black");
    }

    function blockHeight(str: string, width: number, size = 10): number {
      if (!str) return size * 1.35;
      if (rtl || containsArabic(str)) return Math.max(wrapArabicText(doc, str, width, size, fonts).length, 1) * size * 1.35;
      return doc.font("Helvetica").fontSize(size).heightOfString(str, { width });
    }

    // ---------- Cover page ----------
    if (content.showCoverPage) {
      doc.addPage();
      if (style.coverStyle === "dark") {
        doc.rect(0, 0, pageWidth, doc.page.height).fill([pr, pg, pb]);
        doc.fillColor("white");
      } else {
        doc.fillColor([pr, pg, pb]);
      }
      drawLogoSafely(PAGE_MARGIN, 90, 150, 90);
      const coverY = 260;
      writeText(data.company.tradeName || data.company.legalName, PAGE_MARGIN, coverY, contentWidth, {
        bold: true,
        size: 22,
        align: rtl ? undefined : "left",
        color: style.coverStyle === "dark" ? [255, 255, 255] : [pr, pg, pb],
      });
      writeText(data.boq.title, PAGE_MARGIN, coverY + 40, contentWidth, {
        size: 16,
        color: style.coverStyle === "dark" ? [226, 232, 240] : [51, 65, 85],
      });
      writeText(`${data.project.reference} · Revision ${data.boq.revision}`, PAGE_MARGIN, coverY + 70, contentWidth, {
        size: 11,
        color: style.coverStyle === "dark" ? [148, 163, 184] : [100, 116, 139],
      });
      writeText(`Prepared for: ${data.client.companyName ?? data.client.name}`, PAGE_MARGIN, coverY + 100, contentWidth, {
        size: 11,
        color: style.coverStyle === "dark" ? [148, 163, 184] : [100, 116, 139],
      });
      writeText(
        `Generated ${new Date(data.meta.generatedAt).toLocaleDateString()} by ${data.meta.generatedByName}`,
        PAGE_MARGIN,
        coverY + 125,
        contentWidth,
        { size: 9, color: style.coverStyle === "dark" ? [100, 116, 139] : [148, 163, 184] },
      );
      doc.fillColor("black");
    }

    // ---------- Details page ----------
    doc.addPage();
    let y = PAGE_MARGIN;

    writeText(data.boq.title, PAGE_MARGIN, y, contentWidth, { bold: true, size: 18, color: [pr, pg, pb] });
    y += 28;

    if (content.showCompanyInfo || content.showProjectInfo) {
      const colWidth = (contentWidth - 20) / 2;
      const leftX = PAGE_MARGIN;
      const rightX = PAGE_MARGIN + colWidth + 20;
      let leftY = y;
      let rightY = y;
      if (content.showCompanyInfo) {
        if (!content.showCoverPage) {
          const logoHeight = drawLogoSafely(leftX, leftY, Math.min(colWidth, 110), 40);
          if (logoHeight > 0) leftY += logoHeight + 6;
        }
        writeText("From", leftX, leftY, colWidth, { bold: true, size: 9, color: [ar, ag, ab] });
        leftY += 14;
        const companyLines = [
          data.company.legalName,
          data.company.address ?? "",
          data.company.email,
          data.company.phone ?? "",
          data.company.website ?? "",
          data.company.taxRegistrationNumber ? `TRN: ${data.company.taxRegistrationNumber}` : "",
        ].filter(Boolean);
        for (const line of companyLines) {
          writeText(line, leftX, leftY, colWidth, { size: 10 });
          leftY += blockHeight(line, colWidth) + 2;
        }
      }
      if (content.showProjectInfo) {
        writeText("Bill To / Project", rightX, rightY, colWidth, { bold: true, size: 9, color: [ar, ag, ab] });
        rightY += 14;
        const projectLines = [
          data.client.companyName ?? data.client.name,
          data.project.location,
          `Industry: ${data.project.industry}`,
          `Currency: ${data.project.currency} · Tax rate: ${data.project.taxRate}%`,
          `Revision ${data.boq.revision} · ${data.boq.status.toUpperCase()}${data.meta.isDraft ? " · DRAFT" : ""}`,
        ].filter(Boolean);
        for (const line of projectLines) {
          writeText(line, rightX, rightY, colWidth, { size: 10 });
          rightY += blockHeight(line, colWidth) + 2;
        }
      }
      y = Math.max(leftY, rightY) + 16;
    }

    // ---------- BOQ table ----------
    const showInternal = data.boq.showInternalFields;
    const baseColumns: Column[] = [
      { key: "itemNumber", label: "#", width: 26, align: "center" },
      { key: "itemCode", label: "Code", width: 64 },
      { key: "description", label: "Description", width: content.denseTechnicalTable ? 130 : 160 },
      ...(content.columns.specification ? [{ key: "specification", label: "Spec", width: 90 } as Column] : []),
      { key: "unit", label: "Unit", width: 34, align: "center" as const },
      { key: "quantity", label: "Qty", width: 44, align: "right" as const },
      ...(showInternal ? [{ key: "landedCost", label: "Landed", width: 52, align: "right" as const }] : []),
      ...(showInternal ? [{ key: "marginPercentage", label: "Mgn %", width: 40, align: "right" as const }] : []),
      { key: "sellingRate", label: "Rate", width: 56, align: "right" as const },
      { key: "totalAmount", label: "Total", width: 64, align: "right" as const },
      ...(content.columns.drawingReference ? [{ key: "drawingReference", label: "Dwg", width: 44 } as Column] : []),
    ];
    const totalColumnsWidth = baseColumns.reduce((sum, col) => sum + col.width, 0);
    const scale = contentWidth / totalColumnsWidth;
    const columns = baseColumns.map((col) => ({ ...col, width: col.width * scale }));
    const orderedColumns = rtl ? [...columns].reverse() : columns;

    function drawTableHeader(): number {
      let headerY = y;
      doc.rect(PAGE_MARGIN, headerY, contentWidth, 20).fill([pr, pg, pb]);
      let cx = PAGE_MARGIN;
      for (const col of orderedColumns) {
        doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
        doc.text(col.label, cx + 3, headerY + 6, { width: col.width - 6, align: rtl ? "right" : (col.align ?? "left") });
        cx += col.width;
      }
      doc.fillColor("black");
      return headerY + 20;
    }

    function ensureSpace(neededHeight: number) {
      if (y + neededHeight > CONTENT_BOTTOM) {
        doc.addPage();
        y = PAGE_MARGIN;
        y = drawTableHeader();
      }
    }

    y = drawTableHeader();

    for (const section of data.boq.sections) {
      if (section.items.length === 0) continue;
      ensureSpace(18);
      doc.rect(PAGE_MARGIN, y, contentWidth, 16).fill([226, 232, 240]);
      writeText(`${section.code} — ${section.title}`, PAGE_MARGIN + 4, y + 4, contentWidth - 8, { bold: true, size: 9, color: [51, 65, 85] });
      y += 18;

      for (const item of section.items) {
        const cellValues: Record<string, string> = {
          itemNumber: String(item.itemNumber),
          itemCode: item.itemCode,
          description: item.description,
          specification: item.specification,
          unit: item.unit,
          quantity: item.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          landedCost: (item.landedCost ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          marginPercentage: (item.marginPercentage ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 }),
          sellingRate: (item.sellingRate ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          totalAmount: (item.totalAmount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          drawingReference: item.drawingReference,
        };
        const rowHeight = Math.max(
          ...orderedColumns.map((col) => blockHeight(cellValues[col.key] ?? "", col.width - 6, 8)),
          14,
        ) + 6;
        ensureSpace(rowHeight);

        let cx = PAGE_MARGIN;
        for (const col of orderedColumns) {
          const value = cellValues[col.key] ?? "";
          writeText(value, cx + 3, y + 3, col.width - 6, { size: 8, align: rtl ? "right" : (col.align ?? "left") });
          cx += col.width;
        }
        doc.moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + contentWidth, y + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
        y += rowHeight;
      }
    }

    // ---------- Totals ----------
    ensureSpace(110);
    y += 8;
    // PDF generation is a FINAL_ONLY (locked-revision) type and only ever
    // receives WITH_PRICES data — totals is always populated here; the
    // fallback only satisfies the now-optional shared type, it changes nothing.
    const pdfTotals = data.boq.totals ?? { subtotal: 0, discountAmount: 0, taxableAmount: 0, taxAmount: 0, grandTotal: 0 };
    const totalsRows: Array<[string, string]> = [
      ["Subtotal", formatCurrency(pdfTotals.subtotal, data.project.currency)],
      ["Discount", formatCurrency(pdfTotals.discountAmount, data.project.currency)],
      ["Taxable Amount", formatCurrency(pdfTotals.taxableAmount, data.project.currency)],
      [`VAT (${data.project.taxRate}%)`, formatCurrency(pdfTotals.taxAmount, data.project.currency)],
      ["Grand Total", formatCurrency(pdfTotals.grandTotal, data.project.currency)],
    ];
    const totalsWidth = 220;
    const totalsX = rtl ? PAGE_MARGIN : PAGE_MARGIN + contentWidth - totalsWidth;
    for (const [label, value] of totalsRows) {
      const isGrand = label === "Grand Total";
      writeText(label, totalsX, y, totalsWidth * 0.55, { bold: isGrand, size: isGrand ? 11 : 9.5 });
      writeText(value, totalsX + totalsWidth * 0.55, y, totalsWidth * 0.45, {
        bold: isGrand,
        size: isGrand ? 11 : 9.5,
        align: rtl ? "left" : "right",
      });
      y += isGrand ? 18 : 14;
    }

    // ---------- Terms / Exclusions ----------
    if (content.showTermsSection) {
      ensureSpace(50);
      y += 10;
      writeText("Terms & Payment", PAGE_MARGIN, y, contentWidth, { bold: true, size: 10, color: [ar, ag, ab] });
      y += 14;
      const h = blockHeight(data.boq.termsText, contentWidth, 9);
      ensureSpace(h);
      writeText(data.boq.termsText, PAGE_MARGIN, y, contentWidth, { size: 9 });
      y += h + 10;
    }
    if (content.showExclusionsSection) {
      ensureSpace(50);
      writeText("Exclusions", PAGE_MARGIN, y, contentWidth, { bold: true, size: 10, color: [ar, ag, ab] });
      y += 14;
      const h = blockHeight(data.boq.exclusionsText, contentWidth, 9);
      ensureSpace(h);
      writeText(data.boq.exclusionsText, PAGE_MARGIN, y, contentWidth, { size: 9 });
      y += h + 10;
    }

    // ---------- Signatures ----------
    if (content.showSignatureSection) {
      ensureSpace(60);
      y += 20;
      const halfWidth = (contentWidth - 40) / 2;
      doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + halfWidth, y).strokeColor("#94A3B8").lineWidth(0.75).stroke();
      doc.moveTo(PAGE_MARGIN + contentWidth - halfWidth, y).lineTo(PAGE_MARGIN + contentWidth, y).strokeColor("#94A3B8").lineWidth(0.75).stroke();
      writeText("Prepared by", PAGE_MARGIN, y + 4, halfWidth, { size: 8, color: [100, 116, 139] });
      writeText("Client acceptance", PAGE_MARGIN + contentWidth - halfWidth, y + 4, halfWidth, { size: 8, color: [100, 116, 139], align: rtl ? "left" : "right" });
    }

    // ---------- Footer + page numbers + draft watermark on every page ----------
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i += 1) {
      doc.switchToPage(pageRange.start + i);
      if (style.showPageNumbers) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#94A3B8")
          .text(`Page ${i + 1} of ${pageRange.count}`, PAGE_MARGIN, doc.page.height - 30, {
            width: contentWidth,
            align: "center",
          });
      }
      if (style.footerText) {
        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#CBD5E1")
          .text(style.footerText, PAGE_MARGIN, doc.page.height - 20, { width: contentWidth, align: "center" });
      }
      if (data.meta.isDraft) {
        doc.save();
        doc.rotate(-40, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.fontSize(56).fillColor("#F87171").opacity(0.18);
        doc.text(style.watermarkDraftText, 0, doc.page.height / 2 - 30, { width: doc.page.width, align: "center" });
        doc.opacity(1);
        doc.restore();
      }
      if (data.meta.watermarkText) {
        doc.save();
        doc.rotate(-40, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.fontSize(34).fillColor("#2563EB").opacity(0.22);
        doc.text(data.meta.watermarkText, 0, doc.page.height / 2 + 40, { width: doc.page.width, align: "center" });
        doc.opacity(1);
        doc.restore();
      }
    }

    doc.end();
  });
}
