import { QuantityCalculationType } from "@prisma/client";
import {
  calculateCableLength,
  calculateCeilingArea,
  calculateConcreteVolume,
  calculateDuctSurfaceArea,
  calculateExcavationVolume,
  calculateFlooringArea,
  calculateFormworkArea,
  calculateFurnitureCount,
  calculatePaintArea,
  calculatePartitionArea,
  calculatePipeLength,
  calculateReinforcementWeight,
  calculateSkirtingLength,
  calculateWallFinishArea,
  type FormulaResult,
} from "@/lib/calculations/quantity-formulas";

/**
 * Guided BOQ measurement workflow (Release 1) — the single deterministic
 * source of truth for "what does a professional need to enter, by hand or
 * from evidence, before Quantara can calculate this quantity." Every input
 * here is a real parameter of a real function in quantity-formulas.ts — this
 * registry never invents a new engineering concept, it only describes the
 * human-visible shape of formulas that already exist and are already tested.
 *
 * A calculation type with no entry here (AREA, PERIMETER, LENGTH, VOLUME,
 * CUSTOM) has no deterministic formula wired to it yet — the UI must treat
 * those as "no guided calculation available, quantity must be entered
 * directly," never fabricate a required-input list for them.
 */

export type DimensionInputDefinition = {
  /** Matches quantity-formulas.ts's parameter name exactly — never renamed for display purposes. */
  key: string;
  label: string;
  /** null for a dimensionless input (a percentage, a count, a face count). */
  unit: string | null;
  required: boolean;
};

export type RequiredDimensionsDefinition = {
  calculationType: QuantityCalculationType;
  label: string;
  resultUnit: string;
  inputs: DimensionInputDefinition[];
  /**
   * Delegates to the real formula function in quantity-formulas.ts — never
   * reimplements the math. Throws if a required input is missing so a
   * caller can never silently compute with an invented value.
   */
  compute: (values: Record<string, number>) => FormulaResult;
};

function requireValue(values: Record<string, number>, key: string): number {
  const value = values[key];
  if (value === undefined || value === null || Number.isNaN(value)) {
    throw new Error(`Missing required dimension "${key}" — cannot calculate without it.`);
  }
  return value;
}

function optionalValue(values: Record<string, number>, key: string, fallback: number): number {
  const value = values[key];
  return value === undefined || value === null || Number.isNaN(value) ? fallback : value;
}

export const REQUIRED_DIMENSIONS_REGISTRY: Partial<Record<QuantityCalculationType, RequiredDimensionsDefinition>> = {
  [QuantityCalculationType.FLOOR_AREA]: {
    calculationType: QuantityCalculationType.FLOOR_AREA,
    label: "Floor Area",
    resultUnit: "m2",
    inputs: [
      { key: "netFloorArea", label: "Net Floor Area", unit: "m2", required: true },
      { key: "wastagePercentage", label: "Wastage", unit: "%", required: false },
    ],
    compute: (v) => calculateFlooringArea(requireValue(v, "netFloorArea"), optionalValue(v, "wastagePercentage", 0)),
  },
  [QuantityCalculationType.CEILING_AREA]: {
    calculationType: QuantityCalculationType.CEILING_AREA,
    label: "Ceiling Area",
    resultUnit: "m2",
    inputs: [
      { key: "ceilingArea", label: "Ceiling Area", unit: "m2", required: true },
      { key: "wastagePercentage", label: "Wastage", unit: "%", required: false },
    ],
    compute: (v) => calculateCeilingArea(requireValue(v, "ceilingArea"), optionalValue(v, "wastagePercentage", 0)),
  },
  [QuantityCalculationType.WALL_AREA]: {
    calculationType: QuantityCalculationType.WALL_AREA,
    label: "Wall Area",
    resultUnit: "m2",
    inputs: [
      { key: "wallLength", label: "Wall Length", unit: "m", required: true },
      { key: "wallHeight", label: "Wall Height", unit: "m", required: true },
      { key: "openingsArea", label: "Openings Area (doors/windows)", unit: "m2", required: false },
      { key: "wastagePercentage", label: "Wastage", unit: "%", required: false },
    ],
    compute: (v) =>
      calculateWallFinishArea(
        requireValue(v, "wallLength"),
        requireValue(v, "wallHeight"),
        optionalValue(v, "openingsArea", 0),
        optionalValue(v, "wastagePercentage", 0),
      ),
  },
  [QuantityCalculationType.PAINT_AREA]: {
    calculationType: QuantityCalculationType.PAINT_AREA,
    label: "Paint Area",
    resultUnit: "m2",
    inputs: [
      { key: "wallArea", label: "Wall Area", unit: "m2", required: true },
      { key: "openingsArea", label: "Openings Area (doors/windows)", unit: "m2", required: false },
      { key: "coats", label: "Number of Coats", unit: null, required: true },
    ],
    compute: (v) => calculatePaintArea(requireValue(v, "wallArea"), optionalValue(v, "openingsArea", 0), requireValue(v, "coats")),
  },
  [QuantityCalculationType.PARTITION_AREA]: {
    calculationType: QuantityCalculationType.PARTITION_AREA,
    label: "Partition Area",
    resultUnit: "m2",
    inputs: [
      { key: "length", label: "Length", unit: "m", required: true },
      { key: "height", label: "Height", unit: "m", required: true },
      { key: "faces", label: "Number of Faces", unit: null, required: true },
    ],
    compute: (v) => calculatePartitionArea(requireValue(v, "length"), requireValue(v, "height"), requireValue(v, "faces")),
  },
  [QuantityCalculationType.CONCRETE_VOLUME]: {
    calculationType: QuantityCalculationType.CONCRETE_VOLUME,
    label: "Concrete Volume",
    resultUnit: "m3",
    inputs: [
      { key: "length", label: "Length", unit: "m", required: true },
      { key: "width", label: "Width", unit: "m", required: true },
      { key: "depth", label: "Depth", unit: "m", required: true },
    ],
    compute: (v) => calculateConcreteVolume(requireValue(v, "length"), requireValue(v, "width"), requireValue(v, "depth")),
  },
  [QuantityCalculationType.EXCAVATION_VOLUME]: {
    calculationType: QuantityCalculationType.EXCAVATION_VOLUME,
    label: "Excavation Volume",
    resultUnit: "m3",
    inputs: [
      { key: "length", label: "Length", unit: "m", required: true },
      { key: "width", label: "Width", unit: "m", required: true },
      { key: "depth", label: "Depth", unit: "m", required: true },
    ],
    compute: (v) => calculateExcavationVolume(requireValue(v, "length"), requireValue(v, "width"), requireValue(v, "depth")),
  },
  [QuantityCalculationType.SKIRTING_LENGTH]: {
    calculationType: QuantityCalculationType.SKIRTING_LENGTH,
    label: "Skirting Length",
    resultUnit: "m",
    inputs: [
      { key: "perimeter", label: "Room Perimeter", unit: "m", required: true },
      { key: "totalDoorWidths", label: "Total Door Widths", unit: "m", required: false },
      { key: "wastagePercentage", label: "Wastage", unit: "%", required: false },
    ],
    compute: (v) =>
      calculateSkirtingLength(requireValue(v, "perimeter"), optionalValue(v, "totalDoorWidths", 0), optionalValue(v, "wastagePercentage", 0)),
  },
  [QuantityCalculationType.PIPE_LENGTH]: {
    calculationType: QuantityCalculationType.PIPE_LENGTH,
    label: "Pipe Length",
    resultUnit: "m",
    inputs: [
      { key: "verifiedRouteLength", label: "Verified Route Length", unit: "m", required: true },
      { key: "approvedAllowancePercentage", label: "Approved Allowance", unit: "%", required: false },
    ],
    compute: (v) => calculatePipeLength(requireValue(v, "verifiedRouteLength"), optionalValue(v, "approvedAllowancePercentage", 0)),
  },
  [QuantityCalculationType.DUCT_SURFACE_AREA]: {
    calculationType: QuantityCalculationType.DUCT_SURFACE_AREA,
    label: "Duct Surface Area",
    resultUnit: "m2",
    inputs: [
      { key: "ductPerimeter", label: "Duct Perimeter", unit: "m", required: true },
      { key: "length", label: "Length", unit: "m", required: true },
    ],
    compute: (v) => calculateDuctSurfaceArea(requireValue(v, "ductPerimeter"), requireValue(v, "length")),
  },
  [QuantityCalculationType.CABLE_LENGTH]: {
    calculationType: QuantityCalculationType.CABLE_LENGTH,
    label: "Cable Length",
    resultUnit: "m",
    inputs: [
      { key: "routeLength", label: "Route Length", unit: "m", required: true },
      { key: "verticalDrops", label: "Vertical Drops", unit: "m", required: false },
      { key: "approvedTerminationAllowance", label: "Approved Termination Allowance", unit: "m", required: false },
    ],
    compute: (v) =>
      calculateCableLength(
        requireValue(v, "routeLength"),
        optionalValue(v, "verticalDrops", 0),
        optionalValue(v, "approvedTerminationAllowance", 0),
      ),
  },
  [QuantityCalculationType.REINFORCEMENT_WEIGHT]: {
    calculationType: QuantityCalculationType.REINFORCEMENT_WEIGHT,
    label: "Reinforcement Weight",
    resultUnit: "kg",
    inputs: [
      { key: "scheduleQuantity", label: "Schedule Quantity (if verified)", unit: "kg", required: false },
      { key: "barLength", label: "Bar Length (if no schedule)", unit: "m", required: false },
      { key: "unitWeightPerMeter", label: "Unit Weight per Meter (if no schedule)", unit: "kg/m", required: false },
    ],
    compute: (v) =>
      calculateReinforcementWeight(
        v.scheduleQuantity,
        v.barLength,
        v.unitWeightPerMeter,
      ),
  },
  [QuantityCalculationType.FORMWORK_AREA]: {
    calculationType: QuantityCalculationType.FORMWORK_AREA,
    label: "Formwork Area",
    resultUnit: "m2",
    inputs: [{ key: "exposedConcreteSurfaceArea", label: "Exposed Concrete Surface Area", unit: "m2", required: true }],
    compute: (v) => calculateFormworkArea(requireValue(v, "exposedConcreteSurfaceArea")),
  },
  [QuantityCalculationType.COUNT]: {
    calculationType: QuantityCalculationType.COUNT,
    label: "Count",
    resultUnit: "nr",
    inputs: [{ key: "verifiedCount", label: "Verified Count", unit: null, required: true }],
    compute: (v) => calculateFurnitureCount(requireValue(v, "verifiedCount")),
  },
};

export function getRequiredDimensions(calculationType: QuantityCalculationType): RequiredDimensionsDefinition | null {
  return REQUIRED_DIMENSIONS_REGISTRY[calculationType] ?? null;
}

export function listSupportedCalculationTypes(): QuantityCalculationType[] {
  return Object.keys(REQUIRED_DIMENSIONS_REGISTRY) as QuantityCalculationType[];
}

export type DimensionReviewStatus = "PREFILLED" | "MANUAL_ENTRY" | "MISSING";

export type DimensionValue = {
  key: string;
  label: string;
  unit: string | null;
  required: boolean;
  value: number | null;
  /** Where this value came from — never fabricated, always traceable. */
  source: "extracted_entity" | "detected_room" | "manual_professional_input" | null;
  confidence: number | null;
  reviewStatus: DimensionReviewStatus;
};

/**
 * Determines which required inputs a calculation is still missing.
 * NEVER treats a missing value as zero or any other invented default — a
 * missing required input is missing, full stop, until a human supplies it.
 */
export function getMissingRequiredDimensions(definition: RequiredDimensionsDefinition, dimensionValues: DimensionValue[]): DimensionValue[] {
  const byKey = new Map(dimensionValues.map((d) => [d.key, d]));
  return definition.inputs.filter((input) => {
    if (!input.required) return false;
    const found = byKey.get(input.key);
    return !found || found.value === null || found.value === undefined;
  }).map((input) => byKey.get(input.key) ?? {
    key: input.key,
    label: input.label,
    unit: input.unit,
    required: input.required,
    value: null,
    source: null,
    confidence: null,
    reviewStatus: "MISSING" as const,
  });
}
