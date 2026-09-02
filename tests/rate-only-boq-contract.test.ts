import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RateOnlyBOQEditor } from "../src/components/boq/rate-only-boq-editor";
import {
  calculateRateOnlyAmount,
  parseUnitRateInput,
} from "../src/lib/boq/rate-only-editor";
import { rateOnlyUnitRateInputSchema } from "../src/lib/services/rate-only-boq-service";
import type { BOQ } from "../src/types/boq";

const boq: BOQ = {
  id: "boq-rate-only",
  projectId: "project-rate-only",
  title: "Generated BOQ",
  revision: "R01",
  status: "draft",
  createdAt: "2026-09-02T00:00:00.000Z",
  sections: [
    {
      id: "section-1",
      code: "A",
      title: "Generated works",
      description: "",
      order: 1,
      items: [
        {
          id: "item-1",
          itemNumber: 1,
          itemCode: "A-001",
          category: "Walls",
          description: "Generated gypsum partition",
          specification: "100 mm partition",
          quantity: 12.5,
          unit: "m2",
          unitCost: 0,
          landedCost: 0,
          marginPercentage: 0,
          sellingRate: 0,
          totalAmount: 0,
          wastagePercentage: 0,
          taxApplicable: true,
          sourceReference: "Drawing A-101",
          roomOrZone: "Level 1",
          drawingReference: "A-101",
          confidenceScore: 99,
          status: "CONFIRMED",
          notes: "",
          options: [],
          integrity: {
            quantity: { sourceType: "CONFIRMED_CALCULATION", confirmed: true },
            rate: { sourceType: "LEGACY_UNVERIFIED", confirmed: false },
          },
        },
      ],
    },
  ],
  totals: {
    directCost: 0,
    landedCost: 0,
    grossProfit: 0,
    grossMarginPercentage: 0,
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  },
};

describe("rate-only BOQ contract", () => {
  it("accepts zero and four-decimal rates and calculates quantity x rate", () => {
    expect(parseUnitRateInput("0")).toEqual({ ok: true, value: 0, serialized: "0" });
    expect(parseUnitRateInput("12.3456")).toEqual({ ok: true, value: 12.3456, serialized: "12.3456" });
    expect(calculateRateOnlyAmount(12.5, 12.3456)).toBe(154.32);
  });

  it("rejects blank, negative, non-finite, over-precision and out-of-range rates", () => {
    for (const value of ["", "-1", "Infinity", "1.23456", "100000000000000"]) {
      expect(parseUnitRateInput(value).ok).toBe(false);
    }
  });

  it("allows only unitRate at the server boundary", () => {
    expect(rateOnlyUnitRateInputSchema.safeParse({ unitRate: "0" }).success).toBe(true);
    expect(rateOnlyUnitRateInputSchema.safeParse({ unitRate: "10", quantity: 99 }).success).toBe(false);
    expect(rateOnlyUnitRateInputSchema.safeParse({ unitRate: "10", description: "Changed" }).success).toBe(false);
    expect(rateOnlyUnitRateInputSchema.safeParse({ unitRate: "10", unit: "kg" }).success).toBe(false);
  });

  it("renders generated scope read-only, exposes evidence, and provides only a unit-rate input", () => {
    const html = renderToStaticMarkup(createElement(RateOnlyBOQEditor, { boq }));

    expect(html).toContain("Generated gypsum partition");
    expect(html).toContain("12.5");
    expect(html).toContain("m2");
    expect(html).toContain("View quantity evidence");
    expect(html).toContain("Drawing A-101");
    expect(html).toContain("Unit rate for Generated gypsum partition");
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('name="unitRate-item-1"');
    expect(html).not.toContain('name="quantity');
    expect(html).not.toContain('name="description');
    expect(html).not.toContain('name="unit-item');
  });

  it("keeps dirty-state recovery and the narrow endpoint explicit in the component source", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/components/boq/rate-only-boq-editor.tsx"),
      "utf8",
    );

    expect(source).toContain("beforeunload");
    expect(source).toContain("onDirtyChange");
    expect(source).toContain("/unit-rate");
    expect(source).toContain("getApiErrorMessage");
    expect(source).not.toContain("/api/boqs/");
  });

  it("keeps the API route actor-scoped and bound to the strict rate-only schema", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/api/items/[itemId]/unit-rate/route.ts"),
      "utf8",
    );

    expect(source).toContain("getCurrentActor");
    expect(source).toContain("setActorContext(actor)");
    expect(source).toContain("itemIdParamsSchema.parse");
    expect(source).toContain("parseJsonBody(request, rateOnlyUnitRateInputSchema)");
    expect(source).toContain("updateRateOnlyBOQItemUnitRate(actor, itemId, input)");
    expect(source).toContain("withActorRequestContext(PUTHandler)");
  });
});
