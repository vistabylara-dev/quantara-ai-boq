import type { CanonicalDocumentData } from "../build-document-data";

const UTF8_BOM = "﻿";

function escapeCsvField(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(fields: Array<string | number>): string {
  return fields.map(escapeCsvField).join(",") + "\r\n";
}

/**
 * Flat, spreadsheet-friendly export of every BOQ line item. Internal cost
 * columns (unit/freight/installation/additional/landed cost, margin) are
 * only emitted when `data.boq.showInternalFields` is true — CSV inherits the
 * same audience-based field visibility as every other generator via the
 * canonical document data object, it does not decide visibility itself.
 */
export function generateCsv(data: CanonicalDocumentData): Buffer {
  const showInternal = data.boq.showInternalFields;
  const quantitiesOnly = data.boq.pricingMode === "QUANTITIES_ONLY";
  const headers = [
    "Section",
    "Item No.",
    "Item Code",
    "Description",
    "Specification",
    "Quantity",
    "Unit",
    ...(showInternal ? ["Unit Cost", "Freight", "Installation", "Additional", "Landed Cost", "Margin %"] : []),
    ...(quantitiesOnly ? [] : ["Selling Rate", "Total"]),
    "Room / Zone",
    "Drawing Ref.",
    "Notes",
  ];

  let output = UTF8_BOM;
  if (data.meta.watermarkText) {
    output += row([data.meta.watermarkText]);
  }
  output += row(headers);

  for (const section of data.boq.sections) {
    for (const item of section.items) {
      output += row([
        section.title,
        item.itemNumber,
        item.itemCode,
        item.description,
        item.specification,
        item.quantity,
        item.unit,
        ...(showInternal
          ? [
              item.unitCost ?? 0,
              item.freightCost ?? 0,
              item.installationCost ?? 0,
              item.additionalCost ?? 0,
              item.landedCost ?? 0,
              item.marginPercentage ?? 0,
            ]
          : []),
        ...(quantitiesOnly ? [] : [item.sellingRate ?? 0, item.totalAmount ?? 0]),
        item.roomOrZone,
        item.drawingReference,
        item.notes,
      ]);
    }
  }

  output += row([]);
  if (data.meta.watermarkText) {
    output += row([data.meta.watermarkText]);
    output += row([]);
  }
  // CSV generation only ever receives WITH_PRICES data today (QUANTITIES_ONLY
  // is DOCX-only per this mission) — totals is always populated here; the
  // fallback only satisfies the now-optional shared type, it changes nothing.
  const totals = data.boq.totals;
  if (totals) {
    output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Subtotal", totals.subtotal, "", "", ""]);
    output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Discount", totals.discountAmount, "", "", ""]);
    output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "VAT", totals.taxAmount, "", "", ""]);
    output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Grand Total", totals.grandTotal, "", "", ""]);
  }

  return Buffer.from(output, "utf-8");
}
