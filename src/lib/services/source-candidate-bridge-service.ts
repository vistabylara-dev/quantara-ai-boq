import { ExtractedEntityStatus, ExtractedEntityType, ExtractedTableType, ExtractionMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getProjectFileRecord, listProjectFiles } from "@/lib/repositories/project-file-repository";
import { listExtractedTablesForFile, type ExtractedTableRecord } from "@/lib/repositories/extracted-table-repository";
import { hasReviewedTableDerivedCandidates } from "@/lib/repositories/extracted-entity-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";
import { generateFurnitureCandidatesFromStructuredTables } from "@/lib/services/furniture-candidate-service";

/**
 * Structured source → human-review candidate bridge (Release 1). Connects data Quantara
 * ALREADY stores from table extraction (ExtractedTable/Row/Cell) to the existing
 * ExtractedEntity human-review workspace. Deliberately does not read the original file and
 * does not call any AI model — every candidate is built strictly from already-stored,
 * already-parsed structured rows. Nothing this bridge creates is ever auto-confirmed,
 * auto-corrected, or auto-imported into a BOQ: every candidate is created NEEDS_REVIEW, full
 * stop, and a human must act on it through the existing confirm/correct/reject workflow.
 */

const CANDIDATE_GENERATION_VERSION = "structured-table-v1";

/** Only mappings that are semantically defensible. Everything else (including all the
 * ambiguous/mixed schedule types) becomes SCHEDULE_ROW rather than guessed at. */
const TABLE_TYPE_TO_ENTITY_TYPE: Record<ExtractedTableType, ExtractedEntityType> = {
  [ExtractedTableType.FURNITURE_SCHEDULE]: ExtractedEntityType.FURNITURE,
  [ExtractedTableType.EQUIPMENT_SCHEDULE]: ExtractedEntityType.EQUIPMENT,
  [ExtractedTableType.DOOR_SCHEDULE]: ExtractedEntityType.DOOR,
  [ExtractedTableType.WINDOW_SCHEDULE]: ExtractedEntityType.WINDOW,
  [ExtractedTableType.MATERIAL_SCHEDULE]: ExtractedEntityType.MATERIAL,
  [ExtractedTableType.EXISTING_BOQ]: ExtractedEntityType.SCHEDULE_ROW,
  [ExtractedTableType.SUPPLIER_QUOTATION]: ExtractedEntityType.SCHEDULE_ROW,
  [ExtractedTableType.STRUCTURAL_QUANTITY_SCHEDULE]: ExtractedEntityType.SCHEDULE_ROW,
  [ExtractedTableType.FINISH_SCHEDULE]: ExtractedEntityType.SCHEDULE_ROW,
  [ExtractedTableType.GENERIC_TABLE]: ExtractedEntityType.SCHEDULE_ROW,
  [ExtractedTableType.UNKNOWN]: ExtractedEntityType.SCHEDULE_ROW,
};

/** Priority order — the first populated field wins. Matches normalizeColumnKey()'s output space
 * (column-normalization.ts) plus a few additional exact aliases the parsers don't already fold. */
const LABEL_FIELD_PRIORITY = [
  "description",
  "item_description",
  "item_name",
  "name",
  "element",
  "parent_element",
  "material",
  "type",
  "door_type",
  "window_type",
  "item_code",
  "code",
];

/** Every numeric cell is NOT a quantity — only these exact column keys are semantically a
 * candidate's own quantity. A material/technical field like "Concrete = 53 m3" never counts. */
const QUANTITY_FIELD_KEYS = new Set(["quantity", "qty", "count", "total_quantity"]);
const UNIT_FIELD_KEYS = new Set(["unit", "uom", "unit_of_measure", "units"]);

/** Exact semantic column-key → required-dimensions-registry.ts input-key aliases only. An
 * ambiguous heading (area, size, dimension, measurement) is deliberately absent — it must never
 * be guessed into a specific engineering dimension, since PR #16 prefills straight from these
 * top-level technicalData keys with no further judgement of its own. */
const DIMENSION_KEY_ALIASES: Record<string, string> = {
  wall_height: "wallHeight",
  wall_height_mm: "wallHeight",
  wall_height_cm: "wallHeight",
  wall_length: "wallLength",
  wall_length_mm: "wallLength",
  wall_length_cm: "wallLength",
  openings_area: "openingsArea",
  net_floor_area: "netFloorArea",
  ceiling_area: "ceilingArea",
  perimeter: "perimeter",
  length: "length",
  length_m: "length",
  length_mm: "length",
  length_cm: "length",
  width: "width",
  width_m: "width",
  width_mm: "width",
  width_cm: "width",
  depth: "depth",
  depth_m: "depth",
  depth_mm: "depth",
  depth_cm: "depth",
  height: "height",
  height_m: "height",
  height_mm: "height",
  height_cm: "height",
  route_length: "routeLength",
  route_length_mm: "routeLength",
  route_length_cm: "routeLength",
  verified_route_length: "verifiedRouteLength",
  verified_route_length_mm: "verifiedRouteLength",
  verified_route_length_cm: "verifiedRouteLength",
  duct_perimeter: "ductPerimeter",
  duct_perimeter_mm: "ductPerimeter",
  duct_perimeter_cm: "ductPerimeter",
  vertical_drops: "verticalDrops",
  approved_termination_allowance: "approvedTerminationAllowance",
  approved_allowance_percentage: "approvedAllowancePercentage",
  total_door_widths: "totalDoorWidths",
  wall_area: "wallArea",
  exposed_concrete_surface_area: "exposedConcreteSurfaceArea",
  schedule_quantity: "scheduleQuantity",
  bar_length: "barLength",
  bar_length_mm: "barLength",
  bar_length_cm: "barLength",
  unit_weight_per_meter: "unitWeightPerMeter",
  wastage_percentage: "wastagePercentage",
  coats: "coats",
  faces: "faces",
};

const AREA_DIMENSION_KEYS = new Set(["netFloorArea", "ceilingArea", "openingsArea", "wallArea", "exposedConcreteSurfaceArea"]);
const WEIGHT_DIMENSION_KEYS = new Set(["scheduleQuantity"]);

function canonicalEvidenceUnit(value: string): string {
  return value.trim().toLowerCase().replace(/²/g, "2").replace(/³/g, "3").replace(/\s+/g, "");
}

function explicitColumnUnit(columnKey: string): string | null {
  const match = columnKey.match(/_(mm|cm|m|mm2|cm2|m2|kg|g|t)$/);
  return match?.[1] ?? null;
}

/** Converts only an explicit unit suffix/cell unit into the registry's canonical units. */
function normalizeDimensionEvidence(columnKey: string, targetKey: string, value: number, parsedUnit: string | null): number | null {
  const source = canonicalEvidenceUnit(parsedUnit ?? explicitColumnUnit(columnKey) ?? "");
  if (!source) return value;
  if (["wastagePercentage", "approvedAllowancePercentage"].includes(targetKey)) return source === "%" ? value : null;
  if (["faces", "coats"].includes(targetKey)) return ["nr", "no", "nos", "pcs", ""].includes(source) ? value : null;
  if (targetKey === "unitWeightPerMeter") {
    if (["kg/m", "kgperm"].includes(source)) return value;
    if (["g/m", "gperm"].includes(source)) return value / 1_000;
    return null;
  }
  if (WEIGHT_DIMENSION_KEYS.has(targetKey)) {
    if (source === "kg") return value;
    if (source === "g") return value / 1_000;
    if (["t", "tonne", "tonnes"].includes(source)) return value * 1_000;
    return null;
  }
  const factors = AREA_DIMENSION_KEYS.has(targetKey)
    ? { mm2: 0.000001, cm2: 0.0001, m2: 1 }
    : { mm: 0.001, cm: 0.01, m: 1 };
  const factor = factors[source as keyof typeof factors];
  return factor === undefined ? null : value * factor;
}

function normalizedKey(columnKey: string): string {
  return columnKey.trim().toLowerCase();
}

/** Strict numeric (optionally unit-suffixed) parse — never a guess. Returns null for anything
 * ambiguous: ranges, multiple numbers, prose, or no leading number at all. */
function parseNumericWithOptionalUnit(raw: string): { value: number; unit: string | null } | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const pure = trimmed.match(/^-?\d+(?:\.\d+)?$/);
  if (pure) return { value: Number(trimmed), unit: null };
  const withUnit = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z][a-zA-Z0-9²³%/.\-]*)$/);
  if (withUnit) return { value: Number(withUnit[1]), unit: withUnit[2] };
  return null;
}

function buildLabel(cellsByKey: Map<string, string>, rowNumber: number): string {
  for (const key of LABEL_FIELD_PRIORITY) {
    const value = cellsByKey.get(key);
    if (value && value.trim() !== "") return value.trim();
  }
  // No defensible "this is the description" field — fall back to the row's own visible
  // evidence rather than fabricating a professional description.
  const visibleValues = [...cellsByKey.values()].map((v) => v.trim()).filter(Boolean);
  if (visibleValues.length > 0) {
    return visibleValues.slice(0, 4).join(" · ").slice(0, 200);
  }
  // Describes WHERE the evidence is, not what it means — never invented content.
  return `Schedule row ${rowNumber}`;
}

/** Quantity may ONLY come from an explicitly-recognized quantity column — never from "any
 * numeric-looking cell." A combined "0.58 tonne" cell in a recognized quantity column is
 * strictly split into {0.58, "tonne"}; a separate recognized unit column always wins if present. */
function resolveQuantityAndUnit(cellsByKey: Map<string, string>): { quantity: number | null; unit: string | null } {
  let quantityRaw: string | null = null;
  for (const key of QUANTITY_FIELD_KEYS) {
    const value = cellsByKey.get(key);
    if (value !== undefined && value.trim() !== "") {
      quantityRaw = value;
      break;
    }
  }
  if (quantityRaw === null) return { quantity: null, unit: null };

  const parsed = parseNumericWithOptionalUnit(quantityRaw);
  if (!parsed) return { quantity: null, unit: null }; // ambiguous — never guess

  let unit = parsed.unit;
  for (const key of UNIT_FIELD_KEYS) {
    const value = cellsByKey.get(key);
    if (value !== undefined && value.trim() !== "") {
      unit = value.trim(); // an explicit unit column always wins over a parsed suffix
      break;
    }
  }
  return { quantity: parsed.value, unit };
}

export function extractDimensionKeys(cellsByKey: Map<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [columnKey, targetKey] of Object.entries(DIMENSION_KEY_ALIASES)) {
    const raw = cellsByKey.get(columnKey);
    if (raw === undefined) continue;
    const parsed = parseNumericWithOptionalUnit(raw);
    if (parsed) {
      const normalized = normalizeDimensionEvidence(columnKey, targetKey, parsed.value, parsed.unit);
      if (normalized !== null) out[targetKey] = normalized;
    }
  }
  return out;
}

type TableRow = ExtractedTableRecord["rows"][number];

function cellsToMap(row: TableRow): Map<string, string> {
  return new Map(row.cells.map((cell) => [normalizedKey(cell.columnKey), (cell.rawValue ?? "").trim()]));
}

function rowHeaderTitles(row: TableRow): Record<string, string> {
  const normalized = row.normalizedDataJson;
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return {};
  const headerTitles = (normalized as Record<string, unknown>).headerTitles;
  if (!headerTitles || typeof headerTitles !== "object" || Array.isArray(headerTitles)) return {};
  return Object.fromEntries(
    Object.entries(headerTitles as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function buildParentContext(table: ExtractedTableRecord, row: TableRow): Record<string, unknown> | null {
  if (!row.parentRowId) return null;
  const parentRow = table.rows.find((candidate) => candidate.id === row.parentRowId);
  if (!parentRow) return null;
  // Traceability only — deliberately never includes the parent's own quantity/dimension
  // values, so a child candidate can never inherit the parent's numbers.
  return {
    sourceRowId: parentRow.id,
    rowNumber: parentRow.rowNumber,
    label: buildLabel(cellsToMap(parentRow), parentRow.rowNumber),
  };
}

export type GenerateCandidatesResult = {
  status: "generated" | "skipped";
  reason?: string;
  tablesConsidered: number;
  rowsConsidered: number;
  candidatesCreated: number;
};

export type GenerateCandidatesInput = {
  companyId: string;
  /** Slug or canonical UUID — resolved tenant-safely via getProjectRecord(). */
  projectId: string;
  projectFileId: string;
  extractionJobId?: string | null;
};

/**
 * Reads only what is ALREADY stored (ExtractedTable/Row/Cell) for one ProjectFile and creates
 * one NEEDS_REVIEW ExtractedEntity candidate per stored row, at most. Never re-reads the source
 * file, never calls an AI model, never auto-confirms/imports anything.
 *
 * Idempotent: if any TABLE_PARSER candidate for this file has already been reviewed
 * (CONFIRMED/CORRECTED/REJECTED/IMPORTED), generation is skipped entirely rather than risk
 * discarding or duplicating that human work. Otherwise, previously auto-generated but still
 * UNREVIEWED (EXTRACTED/NEEDS_REVIEW) candidates for this file are replaced — never manual
 * entries, never anything already reviewed — so repeated generation never duplicates.
 */
export async function generateCandidatesFromStructuredTables(input: GenerateCandidatesInput): Promise<GenerateCandidatesResult> {
  const project = await getProjectRecord(input.companyId, input.projectId);
  if (project.industryEngine.key === JOINERY_INDUSTRY_KEY) {
    return generateFurnitureCandidatesFromStructuredTables(input);
  }
  const file = await getProjectFileRecord(input.companyId, input.projectFileId);
  if (file.projectId !== project.id) {
    throw new AppError("FILE_PROJECT_MISMATCH", "This file does not belong to the specified project.", 400);
  }

  if (await hasReviewedTableDerivedCandidates(input.companyId, file.id)) {
    return {
      status: "skipped",
      reason: "Reviewed candidates already exist for this file; generation was skipped to avoid discarding or duplicating reviewed work.",
      tablesConsidered: 0,
      rowsConsidered: 0,
      candidatesCreated: 0,
    };
  }

  const tables = await listExtractedTablesForFile(input.companyId, file.id);
  if (tables.length === 0) {
    return { status: "generated", tablesConsidered: 0, rowsConsidered: 0, candidatesCreated: 0 };
  }

  // Safe to regenerate: only ever removes this file's OWN previously auto-generated, still
  // unreviewed candidates — never a manual entry, never anything from another file/project.
  await prisma.extractedEntity.deleteMany({
    where: {
      companyId: input.companyId,
      projectFileId: file.id,
      extractionMethod: ExtractionMethod.TABLE_PARSER,
      status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW] },
    },
  });

  let rowsConsidered = 0;
  let candidatesCreated = 0;

  for (const table of tables) {
    const entityType = TABLE_TYPE_TO_ENTITY_TYPE[table.tableType] ?? ExtractedEntityType.SCHEDULE_ROW;
    const tableConfidence = table.confidence.toNumber();

    for (const row of table.rows) {
      rowsConsidered += 1;
      const cellsByKey = cellsToMap(row);
      const rawData = Object.fromEntries(row.cells.map((cell) => [cell.columnKey, cell.rawValue ?? ""]));
      const headerTitles = rowHeaderTitles(row);

      const label = buildLabel(cellsByKey, row.rowNumber);
      const { quantity, unit } = resolveQuantityAndUnit(cellsByKey);
      const parentContext = buildParentContext(table, row);

      const technicalData: Record<string, unknown> = {
        ...extractDimensionKeys(cellsByKey),
        sourceTableId: table.id,
        sourceRowId: row.id,
        tableType: table.tableType,
        sheetName: table.sheetName ?? null,
        rowNumber: row.rowNumber,
        rawData,
        headerTitles,
        ...(parentContext ? { parentContext } : {}),
        candidateGenerationVersion: CANDIDATE_GENERATION_VERSION,
      };

      // Never upgraded — the weaker of table-level and row-level confidence is always the
      // honest ceiling for evidence a human hasn't reviewed yet.
      const confidence = Math.min(tableConfidence, row.confidence.toNumber());
      const sourceReference = `${file.originalName} · ${table.sheetName ?? table.title ?? table.tableType} · row ${row.rowNumber}`;
      const sourceText = row.cells
        .map((cell) => `${headerTitles[cell.columnKey] ?? cell.columnKey}: ${cell.rawValue ?? ""}`)
        .join("; ")
        .slice(0, 4000);

      await prisma.extractedEntity.create({
        data: {
          companyId: input.companyId,
          projectId: project.id,
          projectFileId: file.id,
          drawingPageId: table.drawingPageId ?? null,
          extractionJobId: input.extractionJobId ?? null,
          entityType,
          label,
          normalizedLabel: label.toLowerCase().trim(),
          quantity,
          unit,
          confidence,
          extractionMethod: ExtractionMethod.TABLE_PARSER,
          sourceText,
          sourceReference,
          technicalDataJson: technicalData as Prisma.InputJsonValue,
          status: ExtractedEntityStatus.NEEDS_REVIEW,
        },
      });
      candidatesCreated += 1;
    }
  }

  await createAuditLog(input.companyId, {
    entityType: "ProjectFile",
    entityId: file.id,
    action: "STRUCTURED_SOURCE_CANDIDATES_GENERATED",
    payload: {
      projectId: project.id,
      projectFileId: file.id,
      extractionJobId: input.extractionJobId ?? null,
      tablesConsidered: tables.length,
      rowsConsidered,
      candidatesCreated,
      generationVersion: CANDIDATE_GENERATION_VERSION,
    },
  });

  return { status: "generated", tablesConsidered: tables.length, rowsConsidered, candidatesCreated };
}

export type PrepareCandidatesInput = {
  /** Slug or canonical UUID. */
  projectId: string;
  /** If provided, only this file is prepared (still tenant/project-verified). If omitted, every
   * file in the project is considered — a file with no stored tables simply contributes zero
   * candidates, never a fabricated one. */
  projectFileId?: string | null;
};

export type PrepareCandidatesResult = {
  filesConsidered: number;
  filesPrepared: number;
  filesSkippedBecauseReviewed: number;
  tablesConsidered: number;
  rowsConsidered: number;
  candidatesCreated: number;
};

/**
 * Backfill for projects with tables extracted before this bridge existed. Never re-reads or
 * reprocesses the source file — strictly generates review candidates from already-stored
 * ExtractedTable/Row/Cell rows, file by file, reusing generateCandidatesFromStructuredTables's
 * own idempotency/reviewed-protection for each one.
 */
export async function prepareStructuredSourceCandidates(actor: CurrentActor, input: PrepareCandidatesInput): Promise<PrepareCandidatesResult> {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, input.projectId);

  let files: { id: string }[];
  if (input.projectFileId) {
    const file = await getProjectFileRecord(actor.companyId, input.projectFileId);
    if (file.projectId !== project.id) {
      throw new AppError("FILE_PROJECT_MISMATCH", "This file does not belong to the specified project.", 400);
    }
    files = [file];
  } else {
    files = await listProjectFiles(actor.companyId, project.id);
  }

  const totals: PrepareCandidatesResult = {
    filesConsidered: files.length,
    filesPrepared: 0,
    filesSkippedBecauseReviewed: 0,
    tablesConsidered: 0,
    rowsConsidered: 0,
    candidatesCreated: 0,
  };

  for (const file of files) {
    const result = await generateCandidatesFromStructuredTables({
      companyId: actor.companyId,
      projectId: project.id,
      projectFileId: file.id,
    });
    if (result.status === "skipped") {
      totals.filesSkippedBecauseReviewed += 1;
    } else {
      totals.filesPrepared += 1;
    }
    totals.tablesConsidered += result.tablesConsidered;
    totals.rowsConsidered += result.rowsConsidered;
    totals.candidatesCreated += result.candidatesCreated;
  }

  return totals;
}
