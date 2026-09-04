import { QuantityCalculationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  resolveAutonomousMeasurementPolicyRule,
} from "@/lib/autonomous-boq/measurement-policy";

const rules = [
  {
    id: "electrical-circuit-count",
    calculationType: QuantityCalculationType.COUNT,
    boqUnit: "nos",
  },
  {
    id: "electrical-point-count",
    calculationType: QuantityCalculationType.COUNT,
    boqUnit: "points",
  },
  {
    id: "electrical-cable-route",
    calculationType: QuantityCalculationType.CABLE_LENGTH,
    boqUnit: "m",
  },
] as const;

describe("autonomous measurement policy binding", () => {
  it("binds an evaluated result to the exact allowed rule selected in workPackage", () => {
    expect(resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical-point-count",
      calculationType: QuantityCalculationType.COUNT,
      calculatedResultUnit: "nr",
      allowedRules: rules,
    })).toEqual({
      ruleId: "electrical-point-count",
      resultUnit: "points",
    });
  });

  it("normalizes only compatible count and linear aliases", () => {
    expect(resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical-circuit-count",
      calculationType: QuantityCalculationType.COUNT,
      calculatedResultUnit: "nr",
      allowedRules: rules,
    }).resultUnit).toBe("nos");
    expect(resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical-cable-route",
      calculationType: QuantityCalculationType.CABLE_LENGTH,
      calculatedResultUnit: "m",
      allowedRules: rules,
    }).resultUnit).toBe("m");
  });

  it("rejects a rule from another calculation type", () => {
    expect(() => resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical-point-count",
      calculationType: QuantityCalculationType.CABLE_LENGTH,
      calculatedResultUnit: "m",
      allowedRules: rules,
    })).toThrow(/does not allow/i);
  });

  it("rejects an unregistered or ambiguous work package instead of guessing", () => {
    expect(() => resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical",
      calculationType: QuantityCalculationType.COUNT,
      calculatedResultUnit: "nr",
      allowedRules: rules,
    })).toThrow(/exact industry rule/i);
  });

  it("rejects an incompatible calculated result unit", () => {
    expect(() => resolveAutonomousMeasurementPolicyRule({
      workPackage: "electrical-cable-route",
      calculationType: QuantityCalculationType.CABLE_LENGTH,
      calculatedResultUnit: "m2",
      allowedRules: rules,
    })).toThrow(/incompatible/i);
  });
});
