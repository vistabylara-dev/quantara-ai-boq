import { Prisma } from "@prisma/client";
import type { DecimalInput } from "@/lib/calculations/boq-calculator";

export type VerificationSeverityValue = "INFO" | "WARNING" | "CRITICAL";

export type VerificationRuleType =
  | "MISSING_QUANTITY"
  | "ZERO_QUANTITY"
  | "NEGATIVE_QUANTITY"
  | "MISSING_UNIT"
  | "MISSING_DESCRIPTION"
  | "ZERO_SELLING_RATE"
  | "NEGATIVE_COST"
  | "MARGIN_BELOW_MINIMUM"
  | "LOW_CONFIDENCE"
  | "MISSING_DRAWING_REFERENCE"
  | "EXPIRED_SUPPLIER_RATE"
  | "MISSING_SPECIFICATION"
  | "DUPLICATE_ITEM_CODE"
  | "UNUSUALLY_HIGH_QUANTITY"
  | "LOCKED_REVISION_CONFLICT";

export type VerificationItemInput = {
  id: string;
  itemCode?: string | null;
  description?: string | null;
  specification?: string | null;
  quantity?: DecimalInput | null;
  unit?: string | null;
  unitCost?: DecimalInput | null;
  freightCost?: DecimalInput | null;
  installationCost?: DecimalInput | null;
  additionalCost?: DecimalInput | null;
  landedCost?: DecimalInput | null;
  sellingRate?: DecimalInput | null;
  marginPercentage?: DecimalInput | null;
  confidenceScore?: DecimalInput | null;
  drawingReference?: string | null;
  supplierRateExpiryDate?: Date | string | null;
  status?: string | null;
};

export type VerificationConfig = {
  minimumMarginPercentage: DecimalInput;
  confidenceThreshold: DecimalInput;
  unusuallyHighQuantityThreshold: DecimalInput;
};

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  minimumMarginPercentage: 10,
  confidenceThreshold: 85,
  unusuallyHighQuantityThreshold: 10_000,
};

export type VerificationRunInput = {
  boqId: string;
  items: VerificationItemInput[];
  /** Required so verification is repeatable and never depends on the system clock. */
  asOf: Date | string;
  config?: Partial<VerificationConfig>;
  lockedRevisionConflict?: boolean;
  boqIsLocked?: boolean;
  hasPendingChanges?: boolean;
};

export type VerificationExceptionDraft = {
  boqId: string;
  boqItemId: string | null;
  type: VerificationRuleType;
  severity: VerificationSeverityValue;
  message: string;
  currentValue: string;
  suggestedValue: string | null;
  resolved: false;
};

export class VerificationInputError extends Error {
  readonly code = "INVALID_VERIFICATION_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "VerificationInputError";
  }
}

function optionalDecimal(value: DecimalInput | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  try {
    const parsed = new Prisma.Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function requiredConfigDecimal(value: DecimalInput, field: keyof VerificationConfig): Prisma.Decimal {
  const parsed = optionalDecimal(value);
  if (!parsed || parsed.isNegative()) {
    throw new VerificationInputError(`${field} must be a finite, non-negative decimal.`);
  }
  return parsed;
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function currentDecimal(value: Prisma.Decimal | null): string {
  return value?.toString() ?? "missing";
}

function exception(
  input: VerificationRunInput,
  item: VerificationItemInput | null,
  type: VerificationRuleType,
  severity: VerificationSeverityValue,
  message: string,
  currentValue: string,
  suggestedValue: string | null = null,
): VerificationExceptionDraft {
  return {
    boqId: input.boqId,
    boqItemId: item?.id ?? null,
    type,
    severity,
    message,
    currentValue,
    suggestedValue,
    resolved: false,
  };
}

function isVerificationActiveItem(item: VerificationItemInput): boolean {
  return item.status?.toUpperCase() !== "REJECTED";
}

export function runVerification(input: VerificationRunInput): VerificationExceptionDraft[] {
  if (!input.boqId.trim()) {
    throw new VerificationInputError("boqId is required.");
  }

  const asOf = input.asOf instanceof Date ? new Date(input.asOf.getTime()) : new Date(input.asOf);
  if (Number.isNaN(asOf.getTime())) {
    throw new VerificationInputError("asOf must be a valid deterministic date.");
  }

  const config = {
    ...DEFAULT_VERIFICATION_CONFIG,
    ...input.config,
  };
  const minimumMargin = requiredConfigDecimal(config.minimumMarginPercentage, "minimumMarginPercentage");
  const confidenceThreshold = requiredConfigDecimal(config.confidenceThreshold, "confidenceThreshold");
  const highQuantityThreshold = requiredConfigDecimal(
    config.unusuallyHighQuantityThreshold,
    "unusuallyHighQuantityThreshold",
  );
  const results: VerificationExceptionDraft[] = [];
  const activeItems = input.items.filter(isVerificationActiveItem);

  for (const item of activeItems) {
    const quantity = optionalDecimal(item.quantity);
    if (quantity === null) {
      results.push(
        exception(input, item, "MISSING_QUANTITY", "CRITICAL", "Item quantity is missing.", "missing", "Enter a quantity greater than zero."),
      );
    } else if (quantity.isZero()) {
      results.push(
        exception(input, item, "ZERO_QUANTITY", "WARNING", "Item quantity is zero.", quantity.toString(), "Confirm or enter a quantity greater than zero."),
      );
    } else if (quantity.isNegative()) {
      results.push(
        exception(input, item, "NEGATIVE_QUANTITY", "CRITICAL", "Item quantity cannot be negative.", quantity.toString(), "Enter a quantity of zero or greater."),
      );
    } else if (quantity.greaterThan(highQuantityThreshold)) {
      results.push(
        exception(
          input,
          item,
          "UNUSUALLY_HIGH_QUANTITY",
          "WARNING",
          `Item quantity exceeds the configured threshold of ${highQuantityThreshold.toString()}.`,
          quantity.toString(),
          "Confirm the quantity against the source documents.",
        ),
      );
    }

    if (isBlank(item.unit)) {
      results.push(exception(input, item, "MISSING_UNIT", "CRITICAL", "Item unit is missing.", "missing", "Select a valid unit."));
    }

    if (isBlank(item.description)) {
      results.push(
        exception(input, item, "MISSING_DESCRIPTION", "CRITICAL", "Item description is missing.", "missing", "Enter a clear item description."),
      );
    }

    const sellingRate = optionalDecimal(item.sellingRate);
    if (sellingRate === null || sellingRate.isZero()) {
      results.push(
        exception(input, item, "ZERO_SELLING_RATE", "CRITICAL", "Item selling rate is zero or missing.", currentDecimal(sellingRate), "Recalculate or enter a selling rate greater than zero."),
      );
    }

    const negativeCostFields = (
      ["unitCost", "freightCost", "installationCost", "additionalCost", "landedCost"] as const
    ).flatMap((field) => {
      const value = optionalDecimal(item[field]);
      return value?.isNegative() ? [`${field}=${value.toString()}`] : [];
    });
    if (negativeCostFields.length > 0) {
      results.push(
        exception(input, item, "NEGATIVE_COST", "CRITICAL", "Item contains one or more negative costs.", negativeCostFields.join(", "), "Correct all costs to zero or greater."),
      );
    }

    const marginPercentage = optionalDecimal(item.marginPercentage);
    if (marginPercentage !== null && marginPercentage.lessThan(minimumMargin)) {
      results.push(
        exception(
          input,
          item,
          "MARGIN_BELOW_MINIMUM",
          marginPercentage.isNegative() ? "CRITICAL" : "WARNING",
          `Item margin is below the configured minimum of ${minimumMargin.toString()}%.`,
          marginPercentage.toString(),
          minimumMargin.toString(),
        ),
      );
    }

    const confidence = optionalDecimal(item.confidenceScore);
    if (confidence === null || confidence.lessThan(confidenceThreshold)) {
      results.push(
        exception(
          input,
          item,
          "LOW_CONFIDENCE",
          "WARNING",
          `Item confidence is below ${confidenceThreshold.toString()}%.`,
          currentDecimal(confidence),
          "Review the item against its source document.",
        ),
      );
    }

    if (isBlank(item.drawingReference)) {
      results.push(
        exception(input, item, "MISSING_DRAWING_REFERENCE", "WARNING", "Item drawing reference is missing.", "missing", "Add the applicable drawing reference."),
      );
    }

    if (item.supplierRateExpiryDate) {
      const expiryDate = item.supplierRateExpiryDate instanceof Date
        ? item.supplierRateExpiryDate
        : new Date(item.supplierRateExpiryDate);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < asOf.getTime()) {
        results.push(
          exception(
            input,
            item,
            "EXPIRED_SUPPLIER_RATE",
            "WARNING",
            "The supplier rate has expired.",
            expiryDate.toISOString(),
            "Refresh the rate from the supplier catalogue.",
          ),
        );
      }
    }

    if (isBlank(item.specification)) {
      results.push(
        exception(input, item, "MISSING_SPECIFICATION", "WARNING", "Item specification is missing.", "missing", "Add a measurable specification."),
      );
    }
  }

  const itemsByCode = new Map<string, VerificationItemInput[]>();
  for (const item of activeItems) {
    const normalizedCode = item.itemCode?.trim().toUpperCase();
    if (!normalizedCode) continue;
    const matches = itemsByCode.get(normalizedCode) ?? [];
    matches.push(item);
    itemsByCode.set(normalizedCode, matches);
  }
  for (const [itemCode, duplicateItems] of itemsByCode) {
    if (duplicateItems.length < 2) continue;
    for (const item of duplicateItems) {
      results.push(
        exception(input, item, "DUPLICATE_ITEM_CODE", "WARNING", `Item code ${itemCode} is duplicated within this BOQ.`, itemCode, "Use a unique item code or confirm the duplicate."),
      );
    }
  }

  if (input.lockedRevisionConflict || (input.boqIsLocked && input.hasPendingChanges)) {
    results.push(
      exception(
        input,
        null,
        "LOCKED_REVISION_CONFLICT",
        "CRITICAL",
        "Pending changes conflict with a locked BOQ revision.",
        "locked revision with pending changes",
        "Create a new revision before making changes.",
      ),
    );
  }

  return results;
}

export type VerificationSummary = {
  unresolvedCriticalCount: number;
  unresolvedWarningCount: number;
  unresolvedInfoCount: number;
  resolvedCount: number;
  lockBlocked: boolean;
};

export function summarizeVerification(
  exceptions: Array<Pick<VerificationExceptionDraft, "severity"> & { resolved?: boolean }>,
): VerificationSummary {
  const resolvedCount = exceptions.filter((entry) => entry.resolved === true).length;
  const unresolved = exceptions.filter((entry) => entry.resolved !== true);
  const unresolvedCriticalCount = unresolved.filter((entry) => entry.severity === "CRITICAL").length;
  const unresolvedWarningCount = unresolved.filter((entry) => entry.severity === "WARNING").length;
  const unresolvedInfoCount = unresolved.filter((entry) => entry.severity === "INFO").length;

  return {
    unresolvedCriticalCount,
    unresolvedWarningCount,
    unresolvedInfoCount,
    resolvedCount,
    lockBlocked: unresolvedCriticalCount > 0,
  };
}

export function hasBlockingCriticalExceptions(
  exceptions: Array<Pick<VerificationExceptionDraft, "severity"> & { resolved?: boolean }>,
): boolean {
  return summarizeVerification(exceptions).lockBlocked;
}
