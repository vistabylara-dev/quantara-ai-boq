import type { IndustryDiscipline } from "@/types/industry";

export const FURNITURE_JOINERY_INDUSTRY_KEY = "furniture-joinery-cabinetry" as const;
export const FURNITURE_JOINERY_INDUSTRY_NAME = "Furniture, Joinery & Cabinetry" as const;
export const FURNITURE_HIERARCHY_SCHEMA_VERSION = 1 as const;
export const FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND = "FURNITURE_PART_CANDIDATE" as const;
export const FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND = "FURNITURE_ORDER_ITEM_CANDIDATE" as const;
export const FURNITURE_MANAGED_SOURCE_PREFIX = "[FJC_MANAGED_V1:" as const;
export const FURNITURE_MANAGED_ITEM_CODE_PREFIX = "FJC-M1-" as const;

export type FurnitureManagedRowIdentityInput = {
  industryKey: string;
  sectionCode: string;
  sourceType: string;
  itemCode: string;
  sourceReference: string;
  notes: string;
  category: string;
};

function stableManagedHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

export function furnitureManagedItemCodeForKey(managedKey: string): string {
  return `${FURNITURE_MANAGED_ITEM_CODE_PREFIX}${stableManagedHash(managedKey)}`;
}

function readManagedMarker(value: string): string | null {
  if (!value.startsWith(FURNITURE_MANAGED_SOURCE_PREFIX)) return null;
  const markerEnd = value.indexOf("]", FURNITURE_MANAGED_SOURCE_PREFIX.length);
  if (markerEnd < 0) return null;
  try {
    const encodedKey = value.slice(FURNITURE_MANAGED_SOURCE_PREFIX.length, markerEnd);
    return encodedKey ? decodeURIComponent(encodedKey) : null;
  } catch {
    return null;
  }
}

/**
 * A managed row is recognized only when both immutable markers and the
 * deterministic item code agree. A single editable prefix is never enough.
 */
export function readStrictFurnitureManagedKey(input: {
  itemCode: string;
  sourceReference: string;
  notes: string;
}): string | null {
  const sourceKey = readManagedMarker(input.sourceReference);
  const notesKey = readManagedMarker(input.notes);
  if (!sourceKey || sourceKey !== notesKey) return null;
  return input.itemCode === furnitureManagedItemCodeForKey(sourceKey) ? sourceKey : null;
}

const FURNITURE_NON_COMMERCIAL_SECTION_BY_CATEGORY = new Map<string, string>([
  ["PROJECT_SUMMARY", "PRJ"],
  ["CUTTING_LIST", "CUT"],
  ["ASSUMPTION", "VER"],
  ["VERIFICATION_ITEM", "VER"],
  ["SUPPLIED_BY_OTHERS", "HWA"],
]);

/**
 * Only canonical, imported rows in the exact furniture industry can omit
 * commercial pricing. Board and ordinary hardware rows remain commercial.
 */
export function isStrictFurnitureManagedNonCommercialRow(
  input: FurnitureManagedRowIdentityInput,
): boolean {
  const requiredSection = FURNITURE_NON_COMMERCIAL_SECTION_BY_CATEGORY.get(input.category);
  return input.industryKey === FURNITURE_JOINERY_INDUSTRY_KEY
    && input.sourceType === "IMPORT"
    && requiredSection === input.sectionCode
    && readStrictFurnitureManagedKey(input) !== null;
}

export enum FurnitureDiscipline {
  FURNITURE = "FURNITURE",
  JOINERY_CABINETRY = "JOINERY_CABINETRY",
}

export const FURNITURE_DISCIPLINES = [
  {
    id: FurnitureDiscipline.FURNITURE,
    name: "Furniture",
    description: "Loose and fitted furniture schedules, assemblies, parts, finishes, and hardware.",
  },
  {
    id: FurnitureDiscipline.JOINERY_CABINETRY,
    name: "Joinery & Cabinetry",
    description: "Architectural joinery and cabinetry assemblies, panels, finishes, and hardware.",
  },
] satisfies readonly IndustryDiscipline[];

export enum FurnitureHierarchyNodeKind {
  ROOM = "ROOM",
  ELEVATION_REFERENCE = "ELEVATION_REFERENCE",
  ASSEMBLY = "ASSEMBLY",
  PART = "PART",
}

export enum FurnitureVerificationStatus {
  EXTRACTED = "EXTRACTED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  CONFIRMED = "CONFIRMED",
  CORRECTED = "CORRECTED",
  REJECTED = "REJECTED",
}

export type FurnitureEdge = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

export type FurnitureDimensionsMm = {
  width: number | null;
  height: number | null;
  depth: number | null;
  thickness: number | null;
};

export type FurnitureEvidenceLocation = {
  sourceFileId: string;
  sourceFileName: string;
  pageNumber: number | null;
  sheetName: string | null;
  sourceRowNumber: number | null;
  drawingReference: string | null;
  sourceCellReferences: string[];
  geometry: Record<string, unknown> | null;
};

export type FurnitureHardwareItem = {
  key: string;
  description: string;
  quantity: number | null;
  quantityText: string | null;
  unit: string;
  notes: string[];
};

/**
 * Versioned furniture candidate payload stored in an ExtractedEntity's
 * technicalDataJson. Nullable fields represent unavailable source evidence;
 * downstream verification must never replace them with guessed values.
 */
export type FurnitureHierarchyNode = {
  schemaVersion: typeof FURNITURE_HIERARCHY_SCHEMA_VERSION;
  candidateKey: string;
  parentCandidateKey: string | null;
  discipline: FurnitureDiscipline;
  nodeKind: FurnitureHierarchyNodeKind;
  room: string;
  elevationReference: string | null;
  assembly: string | null;
  part: string | null;
  quantity: number | null;
  unitMultiplicity: number;
  dimensionsMm: FurnitureDimensionsMm;
  material: string | null;
  finishColour: string | null;
  edgeBanding: {
    material: string | null;
    selectedEdges: FurnitureEdge[];
  };
  grainDirection: string | null;
  hardware: FurnitureHardwareItem[];
  evidence: FurnitureEvidenceLocation;
  confidence: number | null;
  verificationStatus: FurnitureVerificationStatus;
  verificationIssues: string[];
  notes: string[];
};

export function isFurnitureDiscipline(value: unknown): value is FurnitureDiscipline {
  return Object.values(FurnitureDiscipline).includes(value as FurnitureDiscipline);
}
