import { describe, expect, it } from "vitest";
import {
  BOQCalculationError,
  calculateBOQItem,
  calculateBOQTotals,
  calculateGrossMarginSellingRate,
  calculateLandedCost,
  calculateMarkupSellingRate,
} from "../src/lib/calculations/boq-calculator";

describe("BOQ calculator", () => {
  it("calculates landed cost and markup deterministically", () => {
    const landedCost = calculateLandedCost({
      unitCost: "100",
      freightCost: "10",
      installationCost: "5",
      additionalCost: "2",
    });
    expect(landedCost.toFixed(4)).toBe("117.0000");
    expect(calculateMarkupSellingRate(landedCost, 20).toFixed(4)).toBe("140.4000");

    const item = calculateBOQItem({
      unitCost: "100",
      freightCost: "10",
      installationCost: "5",
      additionalCost: "2",
      quantity: "2.5",
      marginMode: "MARKUP",
      marginPercentage: 20,
    });
    expect(item.totalAmount.toFixed(4)).toBe("351.0000");
  });

  it("calculates gross-margin selling rate", () => {
    expect(calculateGrossMarginSellingRate(100, 20).toFixed(4)).toBe("125.0000");
  });

  it("calculates discount and tax and excludes rejected items", () => {
    const totals = calculateBOQTotals(
      [
        { totalAmount: "351", landedCost: "117", quantity: "2.5", status: "CONFIRMED" },
        { totalAmount: "100", landedCost: "50", quantity: 1, status: "REJECTED" },
      ],
      10,
      5,
    );

    expect(totals.subtotal.toFixed(4)).toBe("351.0000");
    expect(totals.discountAmount.toFixed(4)).toBe("35.1000");
    expect(totals.taxableAmount.toFixed(4)).toBe("315.9000");
    expect(totals.taxAmount.toFixed(4)).toBe("15.7950");
    expect(totals.grandTotal.toFixed(4)).toBe("331.6950");
  });

  it("rejects invalid negative inputs and invalid gross margins", () => {
    expect(() => calculateLandedCost({ unitCost: -1 })).toThrow(BOQCalculationError);
    expect(() => calculateGrossMarginSellingRate(100, 100)).toThrow(BOQCalculationError);
    expect(() => calculateGrossMarginSellingRate(100, 101)).toThrow(BOQCalculationError);
  });

  it("rejects derived values that cannot fit the database decimal columns", () => {
    expect(() =>
      calculateLandedCost({
        unitCost: "99999999999999.9999",
        freightCost: "0.0001",
      }),
    ).toThrow(BOQCalculationError);

    expect(() =>
      calculateBOQItem({
        unitCost: "99999999999999.9999",
        quantity: "1000",
        marginMode: "MARKUP",
        marginPercentage: 0,
      }),
    ).toThrow(BOQCalculationError);
  });
});
