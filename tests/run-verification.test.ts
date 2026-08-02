import { describe, expect, it } from "vitest";
import {
  hasBlockingCriticalExceptions,
  runVerification,
  summarizeVerification,
  type VerificationItemInput,
} from "../src/lib/verification/run-verification";

const validItem: VerificationItemInput = {
  id: "item-valid",
  itemCode: "CON-001",
  description: "Concrete work",
  specification: "C40 concrete",
  quantity: 10,
  unit: "m3",
  unitCost: 100,
  freightCost: 0,
  installationCost: 0,
  additionalCost: 0,
  landedCost: 100,
  sellingRate: 120,
  marginPercentage: 20,
  confidenceScore: 90,
  drawingReference: "A-101",
  supplierRateExpiryDate: "2027-01-01T00:00:00.000Z",
  status: "CONFIRMED",
};

describe("deterministic verification", () => {
  it("returns no exceptions for a complete valid item", () => {
    expect(
      runVerification({
        boqId: "boq-1",
        items: [validItem],
        asOf: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("generates every configured rule type from deterministic inputs", () => {
    const exceptions = runVerification({
      boqId: "boq-1",
      asOf: "2026-01-01T00:00:00.000Z",
      boqIsLocked: true,
      hasPendingChanges: true,
      items: [
        {
          ...validItem,
          id: "item-missing",
          itemCode: "DUP-001",
          quantity: undefined,
          unit: " ",
          description: "",
          specification: "",
          sellingRate: 0,
          unitCost: -1,
          marginPercentage: 5,
          confidenceScore: 80,
          drawingReference: "",
          supplierRateExpiryDate: "2025-01-01T00:00:00.000Z",
        },
        { ...validItem, id: "item-zero", itemCode: "DUP-001", quantity: 0 },
        { ...validItem, id: "item-negative", itemCode: "NEG-001", quantity: -1 },
        { ...validItem, id: "item-high", itemCode: "HIGH-001", quantity: 10_001 },
        { ...validItem, id: "item-below-minimum", itemCode: "MIN-001", minimumSellingRate: 150 },
        { ...validItem, id: "item-overridden", itemCode: "OVR-001", manualOverrideFields: ["unitCost"] },
      ],
    });
    const types = new Set(exceptions.map((entry) => entry.type));

    expect(types).toEqual(
      new Set([
        "MISSING_QUANTITY",
        "ZERO_QUANTITY",
        "NEGATIVE_QUANTITY",
        "MISSING_UNIT",
        "MISSING_DESCRIPTION",
        "ZERO_SELLING_RATE",
        "NEGATIVE_COST",
        "MARGIN_BELOW_MINIMUM",
        "LOW_CONFIDENCE",
        "MISSING_DRAWING_REFERENCE",
        "EXPIRED_SUPPLIER_RATE",
        "MISSING_SPECIFICATION",
        "DUPLICATE_ITEM_CODE",
        "UNUSUALLY_HIGH_QUANTITY",
        "LOCKED_REVISION_CONFLICT",
        "SELLING_RATE_BELOW_LANDED_COST",
        "SELLING_RATE_BELOW_MINIMUM",
        "MANUAL_COMMERCIAL_OVERRIDE",
      ]),
    );
    expect(hasBlockingCriticalExceptions(exceptions)).toBe(true);
    expect(summarizeVerification(exceptions).unresolvedCriticalCount).toBeGreaterThan(0);
  });
});
