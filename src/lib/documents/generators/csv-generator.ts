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
  const headers = [
    "Section",
    "Item No.",
    "Item Code",
    "Description",
    "Specification",
    "Quantity",
    "Unit",
    ...(showInternal ? ["Unit Cost", "Freight", "Installation", "Additional", "Landed Cost", "Margin %"] : []),
    "Selling Rate",
    "Total",
    "Room / Zone",
    "Drawing Ref.",
    "Notes",
  ];

  let output = UTF8_BOM;
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
        item.sellingRate,
        item.totalAmount,
        item.roomOrZone,
        item.drawingReference,
        item.notes,
      ]);
    }
  }

  output += row([]);
  output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Subtotal", data.boq.totals.subtotal, "", "", ""]);
  output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Discount", data.boq.totals.discountAmount, "", "", ""]);
  output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "VAT", data.boq.totals.taxAmount, "", "", ""]);
  output += row(["", "", "", "", "", "", "", ...(showInternal ? ["", "", "", "", "", ""] : []), "Grand Total", data.boq.totals.grandTotal, "", "", ""]);

  return Buffer.from(output, "utf-8");
}
