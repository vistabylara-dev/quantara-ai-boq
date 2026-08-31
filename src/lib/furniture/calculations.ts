import type {
  FurnitureEdgeDimension,
  FurniturePartCandidate,
} from "./candidate-mapper";

export const FURNITURE_CALCULATION_VERSION = "furniture-calculation-v1" as const;

export type FurnitureBoardCalculationOptions = {
  /** Required caller-owned value: visible/editable, never hidden as a global constant. */
  wastagePercentage: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
};

export type FurnitureBoardGroup = {
  key: string;
  material: string;
  rawMaterial: string;
  finish: string | null;
  thicknessMm: number;
  partQuantity: number;
  candidateIds: string[];
  netAreaM2: number;
  wastagePercentage: number;
  areaWithWastageM2: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheetAreaM2: number;
  sheetsRequired: number;
};

export type FurnitureBoardCalculationResult = {
  calculationVersion: typeof FURNITURE_CALCULATION_VERSION;
  groups: FurnitureBoardGroup[];
  excluded: Array<{ candidateId: string; reason: string }>;
};

export type FurnitureEdgeBandingSummary = {
  calculationVersion: typeof FURNITURE_CALCULATION_VERSION;
  totalLinearMetres: number;
  byMode: {
    NONE: number;
    FRONT: number;
    ALL_FOUR: number;
    UNRESOLVED: number;
  };
  unresolvedCandidateIds: string[];
};

export type FurnitureDerivedHardwareSummary = {
  hinges: number;
  drawerSystems: number;
  shelfPins: number;
  pullOutChassis: number;
  unresolvedDoorCandidateIds: string[];
};

export const FURNITURE_ORDER_CATEGORIES = [
  "BOARD",
  "HARDWARE",
  "STONE_QUARTZ",
  "GLASS_MIRROR",
  "APPLIANCE",
  "ELECTRICAL_ACCESSORY",
  "LED",
  "PROPRIETARY_DRAWER_SYSTEM",
  "SUPPLIED_BY_OTHERS",
  "UNCLASSIFIED",
] as const;

export type FurnitureOrderCategory = (typeof FURNITURE_ORDER_CATEGORIES)[number];

export type FurnitureOrderItem = {
  id: string;
  description: string;
  quantity: number | null;
  quantityText: string;
  unit: string | null;
  /** Must be assigned from explicit source/context; separation never guesses a category. */
  category: FurnitureOrderCategory;
  suppliedByOthers: boolean;
  notes: string | null;
  evidence?: {
    sheetName: string | null;
    rowNumber: number;
    sourceCellReferences: string[];
    sourceFileId?: string | null;
    sourceFileName?: string;
    pageNumber?: number | null;
    confidence?: number | null;
    method?: string;
  };
};

function requiredDimension(part: FurniturePartCandidate, dimension: "width" | "height" | "thickness"): number | null {
  const resolved = part.dimensions[dimension];
  if (resolved.hasConflict) return null;
  return resolved.valueMm;
}

function assertCalculationOptions(options: FurnitureBoardCalculationOptions): {
  wastagePercentage: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
} {
  const sheetWidthMm = options.sheetWidthMm ?? 2440;
  const sheetHeightMm = options.sheetHeightMm ?? 1220;
  if (!Number.isFinite(options.wastagePercentage) || options.wastagePercentage < 0) {
    throw new RangeError("wastagePercentage must be a finite non-negative number");
  }
  if (!Number.isFinite(sheetWidthMm) || sheetWidthMm <= 0 || !Number.isFinite(sheetHeightMm) || sheetHeightMm <= 0) {
    throw new RangeError("sheet dimensions must be finite positive millimetre values");
  }
  return { wastagePercentage: options.wastagePercentage, sheetWidthMm, sheetHeightMm };
}

/** Quantity x two-dimensional cut size. Depth is intentionally not substituted for either axis. */
export function calculatePanelNetAreaM2(part: FurniturePartCandidate): number | null {
  const widthMm = requiredDimension(part, "width");
  const heightMm = requiredDimension(part, "height");
  if (part.quantity === null || widthMm === null || heightMm === null) return null;
  return (part.quantity * widthMm * heightMm) / 1_000_000;
}

export function calculateFurnitureBoardGroups(
  parts: readonly FurniturePartCandidate[],
  options: FurnitureBoardCalculationOptions,
): FurnitureBoardCalculationResult {
  const { wastagePercentage, sheetWidthMm, sheetHeightMm } = assertCalculationOptions(options);
  const sheetAreaM2 = (sheetWidthMm * sheetHeightMm) / 1_000_000;
  const groups = new Map<string, FurnitureBoardGroup>();
  const excluded: Array<{ candidateId: string; reason: string }> = [];

  for (const part of parts) {
    const netAreaM2 = calculatePanelNetAreaM2(part);
    const thicknessMm = requiredDimension(part, "thickness");
    if (netAreaM2 === null) {
      excluded.push({ candidateId: part.candidateId, reason: "Missing or conflicting quantity/width/height" });
      continue;
    }
    if (thicknessMm === null) {
      excluded.push({ candidateId: part.candidateId, reason: "Missing or conflicting thickness" });
      continue;
    }
    if (part.material.name.trim() === "") {
      excluded.push({ candidateId: part.candidateId, reason: "Missing material" });
      continue;
    }

    const key = [thicknessMm, part.material.name, part.material.finish ?? ""].join("|");
    const existing = groups.get(key) ?? {
      key,
      material: part.material.name,
      rawMaterial: part.material.raw,
      finish: part.material.finish,
      thicknessMm,
      partQuantity: 0,
      candidateIds: [],
      netAreaM2: 0,
      wastagePercentage,
      areaWithWastageM2: 0,
      sheetWidthMm,
      sheetHeightMm,
      sheetAreaM2,
      sheetsRequired: 0,
    };
    existing.partQuantity += part.quantity ?? 0;
    existing.candidateIds.push(part.candidateId);
    existing.netAreaM2 += netAreaM2;
    groups.set(key, existing);
  }

  for (const group of groups.values()) {
    group.areaWithWastageM2 = group.netAreaM2 * (1 + wastagePercentage / 100);
    group.sheetsRequired = Math.ceil(group.areaWithWastageM2 / sheetAreaM2);
  }

  return {
    calculationVersion: FURNITURE_CALCULATION_VERSION,
  groups: [...groups.values()].sort((left, right) =>
      left.thicknessMm - right.thicknessMm || left.material.localeCompare(right.material)),
    excluded,
  };
}

function selectedDimensionLengthMm(part: FurniturePartCandidate, dimension: FurnitureEdgeDimension): number | null {
  return requiredDimension(part, dimension === "WIDTH" ? "width" : "height");
}

/** Returns null when an edge selection or required orientation is unresolved. */
export function calculateExplicitEdgeLengthM(part: FurniturePartCandidate): number | null {
  if (part.edgeBanding.mode === "NONE") return 0;
  if (part.edgeBanding.selectedEdges.length === 0) return null;
  if (part.quantity === null) return null;

  let singlePartLengthMm = 0;
  for (const edge of part.edgeBanding.selectedEdges) {
    const dimensionLength = selectedDimensionLengthMm(part, edge.dimension);
    if (dimensionLength === null) return null;
    singlePartLengthMm += dimensionLength * edge.count;
  }
  return (part.quantity * singlePartLengthMm) / 1000;
}

export function calculateFurnitureEdgeBanding(parts: readonly FurniturePartCandidate[]): FurnitureEdgeBandingSummary {
  const byMode: FurnitureEdgeBandingSummary["byMode"] = {
    NONE: 0,
    FRONT: 0,
    ALL_FOUR: 0,
    UNRESOLVED: 0,
  };
  const unresolvedCandidateIds: string[] = [];

  for (const part of parts) {
    const length = calculateExplicitEdgeLengthM(part);
    if (length === null) {
      unresolvedCandidateIds.push(part.candidateId);
      continue;
    }
    byMode[part.edgeBanding.mode] += length;
  }

  return {
    calculationVersion: FURNITURE_CALCULATION_VERSION,
    totalLinearMetres: Object.values(byMode).reduce((sum, value) => sum + value, 0),
    byMode,
    unresolvedCandidateIds,
  };
}

function normalizedPart(part: FurniturePartCandidate): string {
  return part.part.trim().toLowerCase();
}

function hingesForDoorHeight(heightMm: number): number {
  if (heightMm <= 900) return 2;
  if (heightMm <= 1600) return 3;
  return 4;
}

function explicitPullOutMultiplicity(assembly: string): number {
  if (/waste\s+bin\s+pull-out\s+cabinet/i.test(assembly)) return 1;
  const count = assembly.match(/\((\d+)x\s+pull-out\s+drawers?\)/i);
  return count ? Number(count[1]) : 0;
}

/**
 * Derives only hardware supported by explicit part labels/dimensions. Flip-down fittings and
 * other specification-led hardware remain sourced from the explicit hardware schedule.
 */
export function calculateDerivedFurnitureHardware(
  parts: readonly FurniturePartCandidate[],
  options: { shelfPinsPerShelf?: number } = {},
): FurnitureDerivedHardwareSummary {
  const shelfPinsPerShelf = options.shelfPinsPerShelf ?? 4;
  if (!Number.isInteger(shelfPinsPerShelf) || shelfPinsPerShelf < 0) {
    throw new RangeError("shelfPinsPerShelf must be a non-negative integer");
  }

  let hinges = 0;
  let drawerSystems = 0;
  let shelfPins = 0;
  const unresolvedDoorCandidateIds: string[] = [];
  const assemblies = new Map<string, string>();

  for (const part of parts) {
    assemblies.set(part.assemblyGroupKey, part.assembly);
    const partName = normalizedPart(part);
    if (partName === "door panel") {
      const heightMm = requiredDimension(part, "height");
      if (part.quantity === null || heightMm === null) {
        unresolvedDoorCandidateIds.push(part.candidateId);
      } else {
        hinges += part.quantity * hingesForDoorHeight(heightMm);
      }
    }
    if (partName === "drawer front panel" && part.quantity !== null) drawerSystems += part.quantity;
    if (partName === "adjustable shelf" && part.quantity !== null) shelfPins += part.quantity * shelfPinsPerShelf;
  }

  const pullOutChassis = [...assemblies.values()]
    .reduce((sum, assembly) => sum + explicitPullOutMultiplicity(assembly), 0);
  return { hinges, drawerSystems, shelfPins, pullOutChassis, unresolvedDoorCandidateIds };
}

/** Category separation is explicit: this function never infers categories from prose. */
export function separateFurnitureOrderItems(
  items: readonly FurnitureOrderItem[],
): Record<FurnitureOrderCategory, FurnitureOrderItem[]> {
  const separated = Object.fromEntries(
    FURNITURE_ORDER_CATEGORIES.map((category) => [category, [] as FurnitureOrderItem[]]),
  ) as Record<FurnitureOrderCategory, FurnitureOrderItem[]>;
  for (const item of items) separated[item.category].push(item);
  return separated;
}
