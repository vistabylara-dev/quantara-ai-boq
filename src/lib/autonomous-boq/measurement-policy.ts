import type { QuantityCalculationType } from "@prisma/client";

export type AutonomousMeasurementPolicyRule = {
  id: string;
  calculationType: QuantityCalculationType;
  boqUnit: string;
};

export class AutonomousMeasurementPolicyBindingError extends Error {
  constructor(
    readonly code:
      | "AUTONOMOUS_POLICY_RULE_REQUIRED"
      | "AUTONOMOUS_POLICY_CALCULATION_NOT_ALLOWED"
      | "AUTONOMOUS_POLICY_UNIT_INCOMPATIBLE",
    message: string,
  ) {
    super(message);
    this.name = "AutonomousMeasurementPolicyBindingError";
  }
}

const COUNT_UNITS = new Set([
  "ea",
  "nr",
  "nos",
  "pcs",
  "points",
  "sets",
  "units",
]);

function canonicalUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/\s+/g, "");
}

function unitsAreCompatible(
  calculationType: QuantityCalculationType,
  calculated: string,
  payable: string,
): boolean {
  if (calculated === payable) return true;
  if (calculationType === "COUNT") {
    return COUNT_UNITS.has(calculated) && COUNT_UNITS.has(payable);
  }
  return calculated === "m" && payable === "lm";
}

/**
 * Binds an evaluated deterministic result to the exact selected industry
 * rule. The provider uses the existing workPackage field for this rule id;
 * the server verifies it and owns the final payable unit normalization.
 */
export function resolveAutonomousMeasurementPolicyRule(input: {
  workPackage: string;
  calculationType: QuantityCalculationType;
  calculatedResultUnit: string;
  allowedRules: readonly AutonomousMeasurementPolicyRule[];
}): { ruleId: string; resultUnit: string } {
  const selectedRuleId = input.workPackage.trim();
  const selected = input.allowedRules.find((rule) => rule.id === selectedRuleId);
  if (!selected) {
    throw new AutonomousMeasurementPolicyBindingError(
      "AUTONOMOUS_POLICY_RULE_REQUIRED",
      "Every autonomous measurement must select one exact industry rule as its work package.",
    );
  }
  if (selected.calculationType !== input.calculationType) {
    throw new AutonomousMeasurementPolicyBindingError(
      "AUTONOMOUS_POLICY_CALCULATION_NOT_ALLOWED",
      `Industry rule ${selected.id} does not allow ${input.calculationType}.`,
    );
  }

  const calculated = canonicalUnit(input.calculatedResultUnit);
  const payable = canonicalUnit(selected.boqUnit);
  if (!unitsAreCompatible(input.calculationType, calculated, payable)) {
    throw new AutonomousMeasurementPolicyBindingError(
      "AUTONOMOUS_POLICY_UNIT_INCOMPATIBLE",
      `Calculated unit ${input.calculatedResultUnit} is incompatible with the payable unit ${selected.boqUnit}.`,
    );
  }

  return { ruleId: selected.id, resultUnit: selected.boqUnit };
}
