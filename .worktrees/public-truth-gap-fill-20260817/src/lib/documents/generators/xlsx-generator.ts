import ExcelJS from "exceljs";
import type { CanonicalDocumentData } from "../build-document-data";

const TITLE_FONT = { bold: true, size: 16, color: { argb: "FF0B1D3A" } };
const SUBTITLE_FONT = { bold: true, size: 11, color: { argb: "FF334155" } };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1D3A" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
const SECTION_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const CURRENCY_FMT = "#,##0.00";

/**
 * Editable workbook with a frozen header row, per-item formulas (Total =
 * Quantity * Selling Rate), and SUM formulas for the grand totals so the
 * sheet stays internally consistent if a user tweaks a quantity in Excel.
 * Internal cost columns and any formula that would expose them are omitted
 * entirely for CLIENT-audience documents (mirrors the CSV/PDF/DOCX rule:
 * visibility is decided once, upstream, in `buildDocumentData`).
 */
export async function generateXlsx(data: CanonicalDocumentData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.company.tradeName || data.company.legalName;
  workbook.created = new Date(data.meta.generatedAt);

  const sheet = workbook.addWorksheet("BOQ", {
    views: [{ state: "frozen", ySplit: 0 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const showInternal = data.boq.showInternalFields;

  const columnHeaders = [
    "Section",
    "Item No.",
    "Item Code",
    "Description",
    "Specification",
    "Qty",
    "Unit",
    ...(showInternal ? ["Unit Cost", "Freight", "Installation", "Additional", "Landed Cost", "Margin %"] : []),
    "Selling Rate",
    "Total",
    "Room / Zone",
    "Drawing Ref.",
    "Notes",
  ];
  const columnWidths = [
    22, 10, 16, 40, 28, 10, 8,
    ...(showInternal ? [12, 10, 12, 11, 12, 10] : []),
    13, 14, 14, 14, 24,
  ];
  const columns = columnHeaders.map((header, index) => ({ header, width: columnWidths[index] }));
  columnWidths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const quantityColIndex = 6;
  const sellingRateColIndex = showInternal ? 14 : 8;
  const totalColIndex = showInternal ? 15 : 9;
  const quantityColLetter = sheet.getColumn(quantityColIndex).letter;
  const sellingRateColLetter = sheet.getColumn(sellingRateColIndex).letter;
  const totalColLetter = sheet.getColumn(totalColIndex).letter;

  // --- Title block (rows 1-5, pushed above the table by inserting later) ---
  sheet.spliceRows(1, 0, [data.company.legalName]);
  sheet.spliceRows(2, 0, [`${data.project.name} (${data.project.reference})`]);
  sheet.spliceRows(3, 0, [`Client: ${data.client.companyName ?? data.client.name}`]);
  sheet.spliceRows(4, 0, [`Revision ${data.boq.revision} · ${data.boq.status.toUpperCase()}${data.meta.isDraft ? " · DRAFT" : ""} · Generated ${new Date(data.meta.generatedAt).toLocaleDateString()}`]);
  sheet.spliceRows(5, 0, []);

  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).font = TITLE_FONT;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).font = SUBTITLE_FONT;
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell(3, 1).font = SUBTITLE_FONT;
  sheet.mergeCells(4, 1, 4, columns.length);
  sheet.getCell(4, 1).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

  let watermarkRowOffset = 0;
  if (data.meta.watermarkText) {
    sheet.spliceRows(5, 0, [data.meta.watermarkText]);
    sheet.mergeCells(5, 1, 5, columns.length);
    sheet.getCell(5, 1).font = { bold: true, size: 11, color: { argb: "FF1D4ED8" } };
    sheet.getCell(5, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    watermarkRowOffset = 1;
  }

  const headerRowNumber = 6 + watermarkRowOffset;
  const headerRow = sheet.getRow(headerRowNumber);
  headerRow.values = columns.map((col) => col.header as string);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: columns.length } };

  let rowCursor = headerRowNumber + 1;
  const firstDataRow = rowCursor;

  for (const section of data.boq.sections) {
    if (section.items.length === 0) continue;
    const sectionRow = sheet.getRow(rowCursor);
    sectionRow.getCell(1).value = `${section.code} — ${section.title}`;
    sheet.mergeCells(rowCursor, 1, rowCursor, columns.length);
    sectionRow.getCell(1).fill = SECTION_FILL;
    sectionRow.getCell(1).font = { bold: true };
    rowCursor += 1;

    for (const item of section.items) {
      const row = sheet.getRow(rowCursor);
      row.getCell(1).value = section.title;
      row.getCell(2).value = item.itemNumber;
      row.getCell(3).value = item.itemCode;
      row.getCell(4).value = item.description;
      row.getCell(5).value = item.specification;
      row.getCell(6).value = item.quantity;
      row.getCell(7).value = item.unit;

      let colIndex = 8;
      if (showInternal) {
        row.getCell(colIndex++).value = item.unitCost ?? 0;
        row.getCell(colIndex++).value = item.freightCost ?? 0;
        row.getCell(colIndex++).value = item.installationCost ?? 0;
        row.getCell(colIndex++).value = item.additionalCost ?? 0;
        row.getCell(colIndex++).value = item.landedCost ?? 0;
        row.getCell(colIndex++).value = item.marginPercentage ?? 0;
      }
      const sellingRateCol = colIndex++;
      row.getCell(sellingRateCol).value = item.sellingRate;
      const totalCol = colIndex++;
      row.getCell(totalCol).value = {
        formula: `${quantityColLetter}${rowCursor}*${sellingRateColLetter}${rowCursor}`,
        result: item.totalAmount,
      };
      row.getCell(colIndex++).value = item.roomOrZone;
      row.getCell(colIndex++).value = item.drawingReference;
      row.getCell(colIndex++).value = item.notes;

      row.getCell(sellingRateCol).numFmt = CURRENCY_FMT;
      row.getCell(totalCol).numFmt = CURRENCY_FMT;
      if (showInternal) {
        for (let c = 8; c <= 13; c += 1) row.getCell(c).numFmt = CURRENCY_FMT;
      }
      rowCursor += 1;
    }
  }
  const lastDataRow = rowCursor - 1;

  rowCursor += 1;
  const totalsLabelCol = sellingRateColIndex;
  function totalsRow(label: string, value: number | { formula: string }) {
    const r = sheet.getRow(rowCursor);
    r.getCell(totalsLabelCol).value = label;
    r.getCell(totalsLabelCol).font = { bold: true };
    const valueCell = r.getCell(totalsLabelCol + 1);
    valueCell.value = value;
    valueCell.numFmt = CURRENCY_FMT;
    valueCell.font = { bold: true };
    rowCursor += 1;
  }

  totalsRow("Subtotal", { formula: `SUM(${totalColLetter}${firstDataRow}:${totalColLetter}${lastDataRow})` });
  totalsRow("Discount", data.boq.totals.discountAmount);
  totalsRow("Taxable Amount", data.boq.totals.taxableAmount);
  totalsRow(`VAT (${data.project.taxRate}%)`, data.boq.totals.taxAmount);
  totalsRow("Grand Total", data.boq.totals.grandTotal);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
