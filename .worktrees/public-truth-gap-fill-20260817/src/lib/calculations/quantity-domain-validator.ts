import type { DimensionValue } from "@/lib/calculations/required-dimensions-registry";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";
import { AppError } from "@/lib/errors/app-error";

const COUNT_LIKE_DIMENSION_KEYS = new Set(["verifiedCount", "coats", "faces"]);

function invalidNumberMessage(label: string, value: number): string {
  if (!Number.isFinite(value)) return `${label} must be a finite number.`;
  if (value < 0) return `${label} must not be negative.`;
  return `${label} must be a whole number.`;
}

function assertFiniteNonnegative(
  value: number,
  label: string,
  code: string,
  field?: string,
): void {
  if (Number.isFinite(value) && value >= 0) return;
  throw new AppError(
    code,
    invalidNumberMessage(label, value),
    422,
    field ? { [field]: [invalidNumberMessage(label, value)] } : undefined,
  );
}

function assertCountLikeInteger(value: number, key: string, label: string, field?: string): void {
  if (!COUNT_LIKE_DIMENSION_KEYS.has(key) || Number.isInteger(value)) return;
  const message = invalidNumberMessage(label, value);
  throw new AppError(
    "INVALID_COUNT_DIMENSION",
    message,
    422,
    field ? { [field]: [message] } : undefined,
  );
}

/**
 * Service-layer validation for callers that bypass the HTTP/Zod boundary.
 * Zero is a valid boundary value; no arbitrary engineering upper limit is
 * imposed. Count-like inputs retain their physical whole-number semantics.
 */
export function assertValidDimensionValues(dimensionValues: readonly DimensionValue[]): void {
  for (const [index, dimension] of dimensionValues.entries()) {
    if (dimension.value === null) continue;
    const field = `dimensionValues.${index}.value`;
    assertFiniteNonnegative(dimension.value, dimension.label || dimension.key, "INVALID_DIMENSION_VALUE", field);
    assertCountLikeInteger(dimension.value, dimension.key, dimension.label || dimension.key, field);
  }
}

function assertValidFormulaRecord(
  values: Record<string, number> | undefined,
  kind: "input" | "deduction" | "allowance",
): void {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    assertFiniteNonnegative(value, `Calculation ${kind} "${key}"`, "INVALID_CALCULATION_RESULT");
    if (kind === "input") assertCountLikeInteger(value, key, `Calculation input "${key}"`);
  }
}

/** Validate the complete deterministic result before any persistence. */
export function assertValidFormulaResult(result: FormulaResult): void {
  assertValidFormulaRecord(result.inputValues, "input");
  assertValidFormulaRecord(result.deductions, "deduction");
  assertValidFormulaRecord(result.allowances, "allowance");
  assertValidCalculatedResult(result.resultValue);
}

/** Validate a computed or persisted result before confirmation/application. */
export function assertValidCalculatedResult(value: number): void {
  assertFiniteNonnegative(value, "Calculated quantity", "INVALID_CALCULATION_RESULT");
}

/** Validate a professional override independently of route-schema validation. */
export function assertValidOverrideResult(value: number): void {
  assertFiniteNonnegative(value, "Override quantity", "INVALID_CALCULATION_OVERRIDE");
}
