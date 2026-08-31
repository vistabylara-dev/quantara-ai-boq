import type { IndustryDiscipline } from "@/types/industry";

export const FURNITURE_JOINERY_INDUSTRY_KEY = "furniture-joinery-cabinetry" as const;
export const FURNITURE_JOINERY_INDUSTRY_NAME = "Furniture, Joinery & Cabinetry" as const;
export const FURNITURE_HIERARCHY_SCHEMA_VERSION = 1 as const;
export const FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND = "FURNITURE_PART_CANDIDATE" as const;

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
