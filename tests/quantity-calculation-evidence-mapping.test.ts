import { QuantityCalculationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveTechnicalDimensionValue } from "../src/lib/services/quantity-calculation-service";
import { extractDimensionKeys } from "../src/lib/services/source-candidate-bridge-service";

describe("quantity calculation evidence mapping", () => {
  it("preserves normalized metre-suffixed schedule dimensions", () => {
    expect(extractDimensionKeys(new Map([
      ["length_m", "4.000"],
      ["width_m", "3.000"],
      ["height_m", "2.800"],
    ]))).toMatchObject({ length: 4, width: 3, height: 2.8 });
  });

  it("derives net floor area only from explicit positive length and width evidence", () => {
    expect(resolveTechnicalDimensionValue(
      QuantityCalculationType.FLOOR_AREA,
      "netFloorArea",
      { length: 4, width: 3 },
    )).toBe(12);
    expect(resolveTechnicalDimensionValue(
      QuantityCalculationType.FLOOR_AREA,
      "netFloorArea",
      { length: 4 },
    )).toBeNull();
  });

  it("prefers an explicit calculator input and never derives unrelated inputs", () => {
    expect(resolveTechnicalDimensionValue(
      QuantityCalculationType.FLOOR_AREA,
      "netFloorArea",
      { netFloorArea: 11.5, length: 4, width: 3 },
    )).toBe(11.5);
    expect(resolveTechnicalDimensionValue(
      QuantityCalculationType.WALL_AREA,
      "wallLength",
      { length: 4, width: 3 },
    )).toBeNull();
  });
});
