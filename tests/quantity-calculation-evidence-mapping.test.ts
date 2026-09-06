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

  it("normalizes explicit metric units and maps building-services formula inputs", () => {
    expect(extractDimensionKeys(new Map([
      ["duct_perimeter_mm", "2400"],
      ["verified_route_length", "18 m"],
      ["vertical_drops", "250 cm"],
      ["schedule_quantity", "1.2 t"],
      ["unit_weight_per_meter", "785 g/m"],
    ]))).toMatchObject({
      ductPerimeter: 2.4,
      verifiedRouteLength: 18,
      verticalDrops: 2.5,
      scheduleQuantity: 1200,
      unitWeightPerMeter: 0.785,
    });
  });

  it("rejects incompatible explicit units instead of silently treating them as metres", () => {
    expect(extractDimensionKeys(new Map([
      ["length", "25 kg"],
      ["wall_area", "12 m"],
    ]))).toEqual({});
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
