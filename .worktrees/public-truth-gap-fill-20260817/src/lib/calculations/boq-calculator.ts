import { Prisma } from "@prisma/client";
import { isFinitePrismaDecimal } from "@/lib/validation/prisma-decimal";

export type DecimalInput = Prisma.Decimal | string | number;
export type MarginModeValue = "MARKUP" | "GROSS_MARGIN";

export const MONEY_DECIMAL_PLACES = 4;

export class BOQCalculationError extends Error {
  readonly code = "INVALID_BOQ_CALCULATION";

  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "BOQCalculationError";
  }
}

function decimal(value: DecimalInput, field: string): Prisma.Decimal {
  let parsed: Prisma.Decimal;

  try {
    parsed = new Prisma.Decimal(value);
  } catch {
    throw new BOQCalculationError(`${field} must be a valid decimal value.`, field);
  }

  if (!isFinitePrismaDecimal(parsed)) {
    throw new BOQCalculationError(`${field} must be finite.`, field);
  }

  return parsed;
}

function nonNegativeDecimal(value: DecimalInput, field: string): Prisma.Decimal {
  const parsed = decimal(value, field);
  if (parsed.isNegative()) {
    throw new BOQCalculationError(`${field} cannot be negative.`, field);
  }
  return parsed;
}

function money(
  value: Prisma.Decimal,
  field: string,
  precision: number,
  scale = MONEY_DECIMAL_PLACES,
): Prisma.Decimal {
  const rounded = value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
  const exclusiveLimit = new Prisma.Decimal(10).pow(precision - scale);
  if (rounded.abs().greaterThanOrEqualTo(exclusiveLimit)) {
    throw new BOQCalculationError(
      `${field} exceeds the supported ${precision}-digit decimal range.`,
      field,
    );
  }
  return rounded;
}

function percentage(
  value: DecimalInput,
  field: string,
  options: { maximum?: number; maximumExclusive?: boolean } = {},
): Prisma.Decimal {
  const parsed = nonNegativeDecimal(value, field);
  if (options.maximum !== undefined) {
    const maximum = new Prisma.Decimal(options.maximum);
    const invalid = options.maximumExclusive ? parsed.greaterThanOrEqualTo(maximum) : parsed.greaterThan(maximum);
    if (invalid) {
      const qualifier = options.maximumExclusive ? "less than" : "at most";
      throw new BOQCalculationError(`${field} must be ${qualifier} ${options.maximum}.`, field);
    }
  }
  return parsed;
}

export function toDecimal(value: DecimalInput, field = "value"): Prisma.Decimal {
  return decimal(value, field);
}

export function decimalToNumber(value: DecimalInput): number {
  return decimal(value, "value").toNumber();
}

export type LandedCostInput = {
  unitCost: DecimalInput;
  freightCost?: DecimalInput;
  installationCost?: DecimalInput;
  additionalCost?: DecimalInput;
};

export function calculateLandedCost(input: LandedCostInput): Prisma.Decimal {
  const unitCost = nonNegativeDecimal(input.unitCost, "unitCost");
  const freightCost = nonNegativeDecimal(input.freightCost ?? 0, "freightCost");
  const installationCost = nonNegativeDecimal(input.installationCost ?? 0, "installationCost");
  const additionalCost = nonNegativeDecimal(input.additionalCost ?? 0, "additionalCost");

  return money(
    unitCost.plus(freightCost).plus(installationCost).plus(additionalCost),
    "landedCost",
    18,
  );
}

export function calculateMarkupSellingRate(
  landedCostInput: DecimalInput,
  marginPercentageInput: DecimalInput,
): Prisma.Decimal {
  const landedCost = nonNegativeDecimal(landedCostInput, "landedCost");
  const marginPercentage = percentage(marginPercentageInput, "marginPercentage");
  return money(
    landedCost.times(new Prisma.Decimal(1).plus(marginPercentage.dividedBy(100))),
    "sellingRate",
    18,
  );
}

export function calculateGrossMarginSellingRate(
  landedCostInput: DecimalInput,
  marginPercentageInput: DecimalInput,
): Prisma.Decimal {
  const landedCost = nonNegativeDecimal(landedCostInput, "landedCost");
  const marginPercentage = percentage(marginPercentageInput, "marginPercentage", {
    maximum: 100,
    maximumExclusive: true,
  });
  const denominator = new Prisma.Decimal(1).minus(marginPercentage.dividedBy(100));

  if (denominator.isZero()) {
    throw new BOQCalculationError("Gross margin percentage causes division by zero.", "marginPercentage");
  }

  return money(landedCost.dividedBy(denominator), "sellingRate", 18);
}

export function calculateSellingRate(
  landedCost: DecimalInput,
  marginMode: MarginModeValue,
  marginPercentage: DecimalInput,
): Prisma.Decimal {
  if (marginMode === "MARKUP") {
    return calculateMarkupSellingRate(landedCost, marginPercentage);
  }
  if (marginMode === "GROSS_MARGIN") {
    return calculateGrossMarginSellingRate(landedCost, marginPercentage);
  }
  throw new BOQCalculationError("marginMode must be MARKUP or GROSS_MARGIN.", "marginMode");
}

export function calculateTotalAmount(quantityInput: DecimalInput, sellingRateInput: DecimalInput): Prisma.Decimal {
  const quantity = nonNegativeDecimal(quantityInput, "quantity");
  const sellingRate = nonNegativeDecimal(sellingRateInput, "sellingRate");
  return money(quantity.times(sellingRate), "totalAmount", 20);
}

export type BOQItemCalculationInput = LandedCostInput & {
  quantity: DecimalInput;
  marginMode: MarginModeValue;
  marginPercentage: DecimalInput;
};

export type BOQItemCalculation = {
  landedCost: Prisma.Decimal;
  sellingRate: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

export function calculateBOQItem(input: BOQItemCalculationInput): BOQItemCalculation {
  const landedCost = calculateLandedCost(input);
  const sellingRate = calculateSellingRate(landedCost, input.marginMode, input.marginPercentage);
  const totalAmount = calculateTotalAmount(input.quantity, sellingRate);
  return { landedCost, sellingRate, totalAmount };
}

export type BOQTotalsItemInput = {
  totalAmount: DecimalInput;
  landedCost?: DecimalInput;
  quantity?: DecimalInput;
  status?: string | null;
};

export type CalculatedBOQTotals = {
  directCost: Prisma.Decimal;
  landedCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  grossMarginPercentage: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  discountPercentage: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
};

export function isActiveBOQItem(item: Pick<BOQTotalsItemInput, "status">): boolean {
  return item.status?.toUpperCase() !== "REJECTED";
}

export function calculateBOQTotals(
  items: BOQTotalsItemInput[],
  discountPercentageInput: DecimalInput = 0,
  taxRateInput: DecimalInput = 0,
): CalculatedBOQTotals {
  const discountPercentage = percentage(discountPercentageInput, "discountPercentage", { maximum: 100 });
  const taxRate = percentage(taxRateInput, "taxRate", { maximum: 100 });
  let subtotal = new Prisma.Decimal(0);
  let totalLandedCost = new Prisma.Decimal(0);

  for (const item of items) {
    if (!isActiveBOQItem(item)) {
      continue;
    }

    subtotal = subtotal.plus(nonNegativeDecimal(item.totalAmount, "item.totalAmount"));
    if (item.landedCost !== undefined) {
      const itemLandedCost = nonNegativeDecimal(item.landedCost, "item.landedCost");
      const quantity = nonNegativeDecimal(item.quantity ?? 1, "item.quantity");
      totalLandedCost = totalLandedCost.plus(itemLandedCost.times(quantity));
    }
  }

  subtotal = money(subtotal, "subtotal", 32);
  totalLandedCost = money(totalLandedCost, "landedCostTotal", 32);
  const discountAmount = money(subtotal.times(discountPercentage).dividedBy(100), "discountAmount", 32);
  const taxableAmount = money(subtotal.minus(discountAmount), "taxableAmount", 32);
  const taxAmount = money(taxableAmount.times(taxRate).dividedBy(100), "taxAmount", 32);
  const grandTotal = money(taxableAmount.plus(taxAmount), "grandTotal", 32);
  const grossProfit = money(subtotal.minus(totalLandedCost), "grossProfit", 32);
  const grossMarginPercentage = subtotal.isZero()
    ? new Prisma.Decimal(0)
    : grossProfit.times(100).dividedBy(subtotal).toDecimalPlaces(MONEY_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);

  return {
    directCost: totalLandedCost,
    landedCost: totalLandedCost,
    grossProfit,
    grossMarginPercentage,
    subtotal,
    discountPercentage,
    discountAmount,
    taxableAmount,
    taxRate,
    taxAmount,
    grandTotal,
  };
}

export const calculateBoqTotals = calculateBOQTotals;
