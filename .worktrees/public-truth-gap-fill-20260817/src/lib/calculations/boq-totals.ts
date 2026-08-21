import type { BOQ, BOQItem, BOQMarginMode, BOQTotals } from "@/types/boq";

function finiteNumber(value: number | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

export function normalizeMarginMode(mode?: BOQMarginMode): "markup" | "gross_margin" {
  return String(mode ?? "markup").toUpperCase() === "GROSS_MARGIN" ? "gross_margin" : "markup";
}

export function calculateLandedCost(
  unitCost: number,
  freightCost = 0,
  installationCost = 0,
  additionalCost = 0,
): number {
  return money(
    finiteNumber(unitCost) +
      finiteNumber(freightCost) +
      finiteNumber(installationCost) +
      finiteNumber(additionalCost),
  );
}

export function calculateSellingRateFromMarkup(landedCost: number, markupPercentage: number): number {
  const markup = Number.isFinite(markupPercentage) ? markupPercentage : 0;
  const rate = landedCost * (1 + markup / 100);
  return money(rate);
}

export function calculateSellingRateFromMargin(landedCost: number, grossMarginPercentage: number): number {
  const margin = Number.isFinite(grossMarginPercentage) ? grossMarginPercentage : 0;
  const denominator = 1 - margin / 100;
  if (denominator <= 0) {
    return money(landedCost);
  }
  const rate = landedCost / denominator;
  return money(rate);
}

export function calculateRowTotal(quantity: number, sellingRate: number): number {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  const rate = Number.isFinite(sellingRate) ? sellingRate : 0;
  return money(qty * rate);
}

export function calculateEditableBOQItem(item: BOQItem): BOQItem {
  const hasComponentCostPayload =
    item.freightCost !== undefined ||
    item.installationCost !== undefined ||
    item.additionalCost !== undefined;
  const landedCost = hasComponentCostPayload
    ? calculateLandedCost(
        item.unitCost,
        item.freightCost,
        item.installationCost,
        item.additionalCost,
      )
    : finiteNumber(item.landedCost, item.unitCost);
  const sellingRate = normalizeMarginMode(item.marginMode) === "gross_margin"
    ? calculateSellingRateFromMargin(landedCost, item.marginPercentage)
    : calculateSellingRateFromMarkup(landedCost, item.marginPercentage);

  return {
    ...item,
    landedCost,
    sellingRate,
    totalAmount: calculateRowTotal(item.quantity, sellingRate),
  };
}

export function calculateTotals(items: BOQItem[], discountPercentage = 0, taxRate = 0): BOQTotals {
  const activeItems = items.filter((item) => item.status.toUpperCase() !== "REJECTED");
  const subtotal = money(
    activeItems.reduce((sum, item) => sum + calculateRowTotal(item.quantity, item.sellingRate), 0),
  );
  const discountAmount = money((subtotal * finiteNumber(discountPercentage)) / 100);
  const taxableAmount = money(subtotal - discountAmount);
  const taxAmount = money((taxableAmount * finiteNumber(taxRate)) / 100);
  const grandTotal = money(taxableAmount + taxAmount);
  const landedCost = money(
    activeItems.reduce(
      (sum, item) => sum + finiteNumber(item.landedCost) * finiteNumber(item.quantity),
      0,
    ),
  );
  const grossProfit = money(subtotal - landedCost);
  const grossMarginPercentage = subtotal > 0 ? money((grossProfit / subtotal) * 100) : 0;

  return {
    directCost: landedCost,
    landedCost,
    grossProfit,
    grossMarginPercentage: Number.isFinite(grossMarginPercentage) ? grossMarginPercentage : 0,
    subtotal,
    discountPercentage,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
  };
}

export function withCalculatedBOQTotals(boq: BOQ, fallbackTaxRate = 0): BOQ {
  const taxRate = finiteNumber(boq.taxRate, fallbackTaxRate);
  return {
    ...boq,
    taxRate,
    totals: calculateTotals(
      boq.sections.flatMap((section) => section.items),
      boq.totals.discountPercentage,
      taxRate,
    ),
  };
}
