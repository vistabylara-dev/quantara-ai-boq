/**
 * Furniture/Joinery candidate mapping is deliberately isolated from the generic extraction
 * bridge. Callers must opt in through `industryEnabled`, and every mapped row remains reviewable.
 * No candidate is persisted, approved, or imported by this module.
 */

export const FURNITURE_CANDIDATE_MAPPING_VERSION = "furniture-candidate-v1" as const;

export type FurnitureCandidateDiscipline = "FURNITURE" | "JOINERY_CABINETRY";
export type FurnitureSourceKind = "WORKBOOK" | "PDF_TABLE" | "EXTRACTED_TABLE";
export type FurnitureDimensionName = "width" | "height" | "depth" | "thickness";
export type FurnitureEdgeDimension = "WIDTH" | "HEIGHT";

export type FurnitureSourceCell = {
  columnKey: string;
  rawValue: string;
  normalizedValue?: string;
  sourceCellReference?: string;
};

export type FurnitureSourceRow = {
  sourceRowId?: string;
  /** Stable logical position used for idempotent regeneration. */
  sourceRowKey?: string;
  rowNumber: number;
  cells: FurnitureSourceCell[];
  confidence?: number | null;
};

/** Structurally compatible with the existing ParsedTable output. */
export type FurnitureSourceTable = {
  sourceTableId?: string;
  /** Stable logical position used for idempotent regeneration. */
  sourceTableKey?: string;
  sheetName?: string;
  title?: string;
  pageNumber?: number;
  rows: FurnitureSourceRow[];
  confidence?: number | null;
  method: string;
};

export type FurnitureMappingContext = {
  /** Furniture-only dispatch guard. False means a safe no-op. */
  industryEnabled: boolean;
  discipline: FurnitureCandidateDiscipline;
  sourceKind: FurnitureSourceKind;
  sourceFileName: string;
  sourceFileId?: string;
  /**
   * A visible/editable source assumption. When omitted, a generic "front edge" cannot be
   * converted to a length because its physical orientation is unknown.
   */
  frontEdgeOrientationAssumption?: FurnitureEdgeDimension | null;
};

export type FurnitureCandidateIssueCode =
  | "MISSING_ROOM"
  | "MISSING_ELEVATION_REFERENCE"
  | "MISSING_ASSEMBLY"
  | "MISSING_PART"
  | "MISSING_QUANTITY"
  | "INVALID_QUANTITY"
  | "MISSING_DIMENSION"
  | "INVALID_DIMENSION"
  | "DIMENSION_CONFLICT"
  | "MISSING_MATERIAL"
  | "FINISH_REQUIRES_VERIFICATION"
  | "GRAIN_DIRECTION_MISSING"
  | "MISSING_EDGE_SELECTION"
  | "UNRECOGNIZED_EDGE_SELECTION"
  | "EDGE_ORIENTATION_REQUIRES_VERIFICATION";

export type FurnitureCandidateIssue = {
  code: FurnitureCandidateIssueCode;
  severity: "BLOCKING" | "REVIEW";
  field?: string;
  message: string;
  evidenceReferences: string[];
};

export type FurnitureDimensionReading = {
  columnKey: string;
  rawValue: string;
  valueMm: number | null;
  evidenceReference: string;
};

export type FurnitureResolvedDimension = {
  valueMm: number | null;
  readings: FurnitureDimensionReading[];
  hasConflict: boolean;
};

export type FurnitureEdgeSelection = {
  dimension: FurnitureEdgeDimension;
  count: 1 | 2;
};

export type FurnitureEdgeBanding = {
  raw: string;
  mode: "NONE" | "FRONT" | "ALL_FOUR" | "UNRESOLVED";
  selectedEdges: FurnitureEdgeSelection[];
  orientation: "EXPLICIT" | "ASSUMED" | "UNRESOLVED";
};

export type FurnitureEvidence = {
  sourceTableId?: string | null;
  sourceRowId?: string | null;
  sourceFileId: string | null;
  sourceFileName: string;
  sourceKind: FurnitureSourceKind;
  method: string;
  sheetName: string | null;
  pageNumber: number | null;
  rowNumber: number;
  drawingReference: string | null;
  confidence: number | null;
  sourceCellReferences: string[];
  rawCells: Record<string, string>;
};

export type FurniturePartCandidate = {
  candidateId: string;
  mappingVersion: typeof FURNITURE_CANDIDATE_MAPPING_VERSION;
  discipline: FurnitureCandidateDiscipline;
  room: string;
  elevationReference: string;
  assembly: string;
  assemblyGroupKey: string;
  part: string;
  quantity: number | null;
  dimensions: Record<FurnitureDimensionName, FurnitureResolvedDimension>;
  material: {
    raw: string;
    name: string;
    finish: string | null;
  };
  edgeBanding: FurnitureEdgeBanding;
  grainDirection: string | null;
  hardwareNotes: string[];
  notes: string | null;
  evidence: FurnitureEvidence;
  issues: FurnitureCandidateIssue[];
  verificationStatus: "BLOCKED" | "NEEDS_REVIEW" | "READY_FOR_REVIEW" | "APPROVED_LOCKED";
};

export type FurniturePartHierarchyNode = {
  kind: "PART";
  key: string;
  label: string;
  candidateId: string;
  quantity: number | null;
};

export type FurnitureAssemblyHierarchyNode = {
  kind: "ASSEMBLY";
  key: string;
  label: string;
  /** Count-only metadata; it must never multiply already-aggregated source part quantities. */
  explicitMultiplicity: number;
  parts: FurniturePartHierarchyNode[];
};

export type FurnitureElevationHierarchyNode = {
  kind: "ELEVATION_REFERENCE";
  key: string;
  label: string;
  assemblies: FurnitureAssemblyHierarchyNode[];
};

export type FurnitureRoomHierarchyNode = {
  kind: "ROOM";
  key: string;
  label: string;
  elevations: FurnitureElevationHierarchyNode[];
};

export type FurnitureHierarchy = {
  rooms: FurnitureRoomHierarchyNode[];
  groupedAssemblyCount: number;
  effectiveAssemblyCount: number;
};

export type FurnitureMappingResult =
  | {
      status: "skipped";
      mappingVersion: typeof FURNITURE_CANDIDATE_MAPPING_VERSION;
      reason: "FURNITURE_INDUSTRY_NOT_ENABLED";
      candidates: [];
      hierarchy: null;
    }
  | {
      status: "mapped";
      mappingVersion: typeof FURNITURE_CANDIDATE_MAPPING_VERSION;
      candidates: FurniturePartCandidate[];
      hierarchy: FurnitureHierarchy;
    };

const COLUMN_ALIASES = {
  room: ["room"],
  elevationReference: ["elevation_ref", "elevation_reference", "elevation", "drawing_reference"],
  assembly: ["cabinet_unit", "cabinet_assembly", "assembly", "cabinet", "unit_assembly"],
  part: ["part", "part_name", "component"],
  quantity: ["quantity", "qty", "count"],
  width: ["width_mm", "panel_width_mm", "cut_width_mm", "width"],
  height: ["height_mm", "panel_height_mm", "cut_height_mm", "height"],
  depth: ["depth_mm", "panel_depth_mm", "depth"],
  thickness: ["thickness_mm", "board_thickness_mm", "thickness"],
  material: ["material", "board_material"],
  finish: ["finish_colour", "finish_color", "finish", "colour", "color"],
  edgeBanding: ["edge_banding", "edge_band", "edges"],
  grainDirection: ["grain_direction", "grain"],
  hardware: ["hardware", "hardware_notes"],
  notes: ["notes", "note", "remarks"],
} as const;

function normalizeColumnKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function normalizeIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createFurnitureAssemblyGroupKey(
  room: string,
  elevationReference: string,
  assembly: string,
): string {
  return [room, elevationReference, assembly].map(normalizeIdentity).join("|");
}

function evidenceReference(table: FurnitureSourceTable, row: FurnitureSourceRow, cell: FurnitureSourceCell): string {
  if (cell.sourceCellReference) return cell.sourceCellReference;
  if (table.sheetName) return `${table.sheetName}!R${row.rowNumber}:${cell.columnKey}`;
  if (table.pageNumber !== undefined) return `page:${table.pageNumber}:row:${row.rowNumber}:${cell.columnKey}`;
  return `row:${row.rowNumber}:${cell.columnKey}`;
}

function cellsForAliases(row: FurnitureSourceRow, aliases: readonly string[]): FurnitureSourceCell[] {
  const accepted = new Set(aliases);
  return row.cells.filter((cell) => accepted.has(normalizeColumnKey(cell.columnKey)) && cell.rawValue.trim() !== "");
}

function firstText(row: FurnitureSourceRow, aliases: readonly string[]): string {
  return cellsForAliases(row, aliases)[0]?.rawValue.trim() ?? "";
}

function strictPositiveNumber(raw: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function strictMillimetres(raw: string): number | null {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:mm)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function missingTextIssue(
  value: string,
  code: FurnitureCandidateIssueCode,
  field: string,
  label: string,
): FurnitureCandidateIssue | null {
  if (value !== "") return null;
  return {
    code,
    severity: "BLOCKING",
    field,
    message: `${label} is required and was not present in the source row.`,
    evidenceReferences: [],
  };
}

function resolveDimension(
  table: FurnitureSourceTable,
  row: FurnitureSourceRow,
  name: FurnitureDimensionName,
  aliases: readonly string[],
  required: boolean,
  issues: FurnitureCandidateIssue[],
): FurnitureResolvedDimension {
  const sourceCells = cellsForAliases(row, aliases);
  const readings = sourceCells.map((cell) => ({
    columnKey: normalizeColumnKey(cell.columnKey),
    rawValue: cell.rawValue,
    valueMm: strictMillimetres(cell.rawValue),
    evidenceReference: evidenceReference(table, row, cell),
  }));

  const invalid = readings.filter((reading) => reading.valueMm === null);
  for (const reading of invalid) {
    issues.push({
      code: "INVALID_DIMENSION",
      severity: "BLOCKING",
      field: name,
      message: `${name} must be a positive millimetre value; ranges and prose are not accepted.`,
      evidenceReferences: [reading.evidenceReference],
    });
  }

  const valid = readings.filter((reading): reading is FurnitureDimensionReading & { valueMm: number } => reading.valueMm !== null);
  const uniqueValues = [...new Set(valid.map((reading) => reading.valueMm))];
  const hasConflict = uniqueValues.length > 1;
  if (hasConflict) {
    issues.push({
      code: "DIMENSION_CONFLICT",
      severity: "BLOCKING",
      field: name,
      message: `Conflicting ${name} values were preserved for professional resolution.`,
      evidenceReferences: valid.map((reading) => reading.evidenceReference),
    });
  }
  if (required && valid.length === 0) {
    issues.push({
      code: "MISSING_DIMENSION",
      severity: "BLOCKING",
      field: name,
      message: `${name} is required for panel calculation and was not present as a valid millimetre value.`,
      evidenceReferences: readings.map((reading) => reading.evidenceReference),
    });
  }

  return {
    valueMm: valid[0]?.valueMm ?? null,
    readings,
    hasConflict,
  };
}

function parseMaterial(raw: string, explicitFinish: string): { raw: string; name: string; finish: string | null } {
  const material = raw.trim();
  if (explicitFinish.trim() !== "") {
    return { raw: material, name: material, finish: explicitFinish.trim() };
  }
  const parenthetical = material.match(/^(.+?)\s*\((.+)\)$/);
  if (!parenthetical) return { raw: material, name: material, finish: null };
  return { raw: material, name: parenthetical[1].trim(), finish: parenthetical[2].trim() };
}

function parseEdgeBanding(
  rawValue: string,
  assumption: FurnitureEdgeDimension | null | undefined,
  evidenceReferences: string[],
  issues: FurnitureCandidateIssue[],
): FurnitureEdgeBanding {
  const raw = rawValue.trim();
  const normalized = raw.toLowerCase();
  if (normalized === "none" || normalized === "no" || normalized === "n/a") {
    return { raw, mode: "NONE", selectedEdges: [], orientation: "EXPLICIT" };
  }
  if (/^all\s*(?:4|four)\s*edges$/.test(normalized)) {
    return {
      raw,
      mode: "ALL_FOUR",
      selectedEdges: [
        { dimension: "WIDTH", count: 2 },
        { dimension: "HEIGHT", count: 2 },
      ],
      orientation: "EXPLICIT",
    };
  }
  if (normalized === "front edge") {
    issues.push({
      code: "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
      severity: "REVIEW",
      field: "edgeBanding",
      message: assumption
        ? `The source says front edge; the editable ${assumption.toLowerCase()} orientation assumption was retained for reconciliation.`
        : "The source says front edge but does not identify whether that edge follows panel width or height.",
      evidenceReferences,
    });
    return {
      raw,
      mode: "FRONT",
      selectedEdges: assumption ? [{ dimension: assumption, count: 1 }] : [],
      orientation: assumption ? "ASSUMED" : "UNRESOLVED",
    };
  }
  if (raw === "") {
    issues.push({
      code: "MISSING_EDGE_SELECTION",
      severity: "BLOCKING",
      field: "edgeBanding",
      message: "Edge banding must be explicitly selected before a length is calculated.",
      evidenceReferences,
    });
  } else {
    issues.push({
      code: "UNRECOGNIZED_EDGE_SELECTION",
      severity: "BLOCKING",
      field: "edgeBanding",
      message: `The edge selection '${raw}' was preserved but not interpreted.`,
      evidenceReferences,
    });
  }
  return { raw, mode: "UNRESOLVED", selectedEdges: [], orientation: "UNRESOLVED" };
}

/**
 * Parses count-only multiplicity without treating component counts such as
 * "2x pull-out drawers" as duplicate assemblies. Ordinal labels like "1 of 4" are already
 * distinct grouped records and deliberately resolve to one.
 */
export function resolveExplicitAssemblyMultiplicity(assemblyLabel: string): number {
  const sections = assemblyLabel.match(/\((\d+)\s+sections?\b/i);
  if (sections) return Math.max(1, Number(sections[1]));

  const pluralCopies = assemblyLabel.match(/\b(?:cabinets|units|columns)\b.*\((\d+)x(?:\s|,|\))/i);
  if (pluralCopies) return Math.max(1, Number(pluralCopies[1]));
  return 1;
}

function rawCells(row: FurnitureSourceRow): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cell of row.cells) {
    const baseKey = normalizeColumnKey(cell.columnKey) || "column";
    let key = baseKey;
    let suffix = 2;
    while (key in result) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    result[key] = cell.rawValue;
  }
  return result;
}

function mapRow(table: FurnitureSourceTable, row: FurnitureSourceRow, context: FurnitureMappingContext): FurniturePartCandidate {
  const issues: FurnitureCandidateIssue[] = [];
  const room = firstText(row, COLUMN_ALIASES.room);
  const elevationReference = firstText(row, COLUMN_ALIASES.elevationReference);
  const assembly = firstText(row, COLUMN_ALIASES.assembly);
  const part = firstText(row, COLUMN_ALIASES.part);

  for (const issue of [
    missingTextIssue(room, "MISSING_ROOM", "room", "Room"),
    missingTextIssue(elevationReference, "MISSING_ELEVATION_REFERENCE", "elevationReference", "Elevation/reference"),
    missingTextIssue(assembly, "MISSING_ASSEMBLY", "assembly", "Assembly"),
    missingTextIssue(part, "MISSING_PART", "part", "Part"),
  ]) {
    if (issue) issues.push(issue);
  }

  const quantityCells = cellsForAliases(row, COLUMN_ALIASES.quantity);
  const quantityRaw = quantityCells[0]?.rawValue.trim() ?? "";
  const quantity = strictPositiveNumber(quantityRaw);
  if (quantityRaw === "") {
    issues.push({
      code: "MISSING_QUANTITY",
      severity: "BLOCKING",
      field: "quantity",
      message: "Quantity is required and was not present in the source row.",
      evidenceReferences: [],
    });
  } else if (quantity === null) {
    issues.push({
      code: "INVALID_QUANTITY",
      severity: "BLOCKING",
      field: "quantity",
      message: "Quantity must be a positive explicit number; ranges and prose are not accepted.",
      evidenceReferences: quantityCells.map((cell) => evidenceReference(table, row, cell)),
    });
  }

  const dimensions = {
    width: resolveDimension(table, row, "width", COLUMN_ALIASES.width, true, issues),
    height: resolveDimension(table, row, "height", COLUMN_ALIASES.height, true, issues),
    depth: resolveDimension(table, row, "depth", COLUMN_ALIASES.depth, false, issues),
    thickness: resolveDimension(table, row, "thickness", COLUMN_ALIASES.thickness, true, issues),
  } satisfies Record<FurnitureDimensionName, FurnitureResolvedDimension>;

  const materialRaw = firstText(row, COLUMN_ALIASES.material);
  const finishRaw = firstText(row, COLUMN_ALIASES.finish);
  const material = parseMaterial(materialRaw, finishRaw);
  if (materialRaw === "") {
    issues.push({
      code: "MISSING_MATERIAL",
      severity: "BLOCKING",
      field: "material",
      message: "Material is required for board grouping and was not present.",
      evidenceReferences: [],
    });
  }
  if (!material.finish || /\bTBD\b/i.test(material.finish)) {
    issues.push({
      code: "FINISH_REQUIRES_VERIFICATION",
      severity: "REVIEW",
      field: "finish",
      message: "Finish/colour is absent or marked TBD and must be verified before ordering.",
      evidenceReferences: cellsForAliases(row, [...COLUMN_ALIASES.material, ...COLUMN_ALIASES.finish])
        .map((cell) => evidenceReference(table, row, cell)),
    });
  }

  const grainCells = cellsForAliases(row, COLUMN_ALIASES.grainDirection);
  const grainDirection = grainCells[0]?.rawValue.trim() || null;
  if (!grainDirection) {
    issues.push({
      code: "GRAIN_DIRECTION_MISSING",
      severity: "REVIEW",
      field: "grainDirection",
      message: "Grain direction was not specified and must not be guessed.",
      evidenceReferences: [],
    });
  }

  const edgeCells = cellsForAliases(row, COLUMN_ALIASES.edgeBanding);
  const edgeBanding = parseEdgeBanding(
    edgeCells[0]?.rawValue ?? "",
    context.frontEdgeOrientationAssumption,
    edgeCells.map((cell) => evidenceReference(table, row, cell)),
    issues,
  );

  const notes = firstText(row, COLUMN_ALIASES.notes) || null;
  const hardwareNotes = cellsForAliases(row, COLUMN_ALIASES.hardware)
    .flatMap((cell) => cell.rawValue.split(/[;,]/))
    .map((value) => value.trim())
    .filter(Boolean);
  const drawingReference = elevationReference || null;
  const sourceCellReferences = row.cells
    .filter((cell) => cell.rawValue.trim() !== "")
    .map((cell) => evidenceReference(table, row, cell));
  const confidence = typeof row.confidence === "number" && Number.isFinite(row.confidence)
    ? row.confidence
    : typeof table.confidence === "number" && Number.isFinite(table.confidence)
      ? table.confidence
      : null;
  const sourceLocation = table.sheetName ?? (table.pageNumber === undefined ? "table" : `page-${table.pageNumber}`);
  const tableIdentity = table.sourceTableKey ?? table.sourceTableId ?? sourceLocation;
  const rowIdentity = row.sourceRowKey ?? row.sourceRowId ?? String(row.rowNumber);
  const candidateId = `${context.sourceFileId ?? context.sourceFileName}:${tableIdentity}:${rowIdentity}`;
  const assemblyGroupKey = createFurnitureAssemblyGroupKey(room, elevationReference, assembly);
  const verificationStatus = issues.some((issue) => issue.severity === "BLOCKING")
    ? "BLOCKED"
    : issues.length > 0
      ? "NEEDS_REVIEW"
      : "READY_FOR_REVIEW";

  return {
    candidateId,
    mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
    discipline: context.discipline,
    room,
    elevationReference,
    assembly,
    assemblyGroupKey,
    part,
    quantity,
    dimensions,
    material,
    edgeBanding,
    grainDirection,
    hardwareNotes,
    notes,
    evidence: {
      sourceTableId: table.sourceTableId ?? null,
      sourceRowId: row.sourceRowId ?? null,
      sourceFileId: context.sourceFileId ?? null,
      sourceFileName: context.sourceFileName,
      sourceKind: context.sourceKind,
      method: table.method,
      sheetName: table.sheetName ?? null,
      pageNumber: table.pageNumber ?? null,
      rowNumber: row.rowNumber,
      drawingReference,
      confidence,
      sourceCellReferences,
      rawCells: rawCells(row),
    },
    issues,
    verificationStatus,
  };
}

export function buildFurnitureHierarchy(candidates: readonly FurniturePartCandidate[]): FurnitureHierarchy {
  const rooms = new Map<string, FurnitureRoomHierarchyNode>();
  for (const candidate of candidates) {
    const roomKey = normalizeIdentity(candidate.room) || "missing-room";
    let room = rooms.get(roomKey);
    if (!room) {
      room = { kind: "ROOM", key: roomKey, label: candidate.room, elevations: [] };
      rooms.set(roomKey, room);
    }

    const elevationKey = `${roomKey}|${normalizeIdentity(candidate.elevationReference) || "missing-elevation"}`;
    let elevation = room.elevations.find((node) => node.key === elevationKey);
    if (!elevation) {
      elevation = {
        kind: "ELEVATION_REFERENCE",
        key: elevationKey,
        label: candidate.elevationReference,
        assemblies: [],
      };
      room.elevations.push(elevation);
    }

    let assembly = elevation.assemblies.find((node) => node.key === candidate.assemblyGroupKey);
    if (!assembly) {
      assembly = {
        kind: "ASSEMBLY",
        key: candidate.assemblyGroupKey,
        label: candidate.assembly,
        explicitMultiplicity: resolveExplicitAssemblyMultiplicity(candidate.assembly),
        parts: [],
      };
      elevation.assemblies.push(assembly);
    }
    assembly.parts.push({
      kind: "PART",
      key: candidate.candidateId,
      label: candidate.part,
      candidateId: candidate.candidateId,
      quantity: candidate.quantity,
    });
  }

  const roomNodes = [...rooms.values()];
  const assemblies = roomNodes.flatMap((room) => room.elevations.flatMap((elevation) => elevation.assemblies));
  return {
    rooms: roomNodes,
    groupedAssemblyCount: assemblies.length,
    effectiveAssemblyCount: assemblies.reduce((sum, assembly) => sum + assembly.explicitMultiplicity, 0),
  };
}

export function mapFurnitureCandidateTable(
  table: FurnitureSourceTable,
  context: FurnitureMappingContext,
): FurnitureMappingResult {
  if (!context.industryEnabled) {
    return {
      status: "skipped",
      mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
      reason: "FURNITURE_INDUSTRY_NOT_ENABLED",
      candidates: [],
      hierarchy: null,
    };
  }

  const candidates = table.rows.map((row) => mapRow(table, row, context));
  return {
    status: "mapped",
    mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
    candidates,
    hierarchy: buildFurnitureHierarchy(candidates),
  };
}
