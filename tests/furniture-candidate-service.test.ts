import { ExtractedEntityStatus, ExtractedTableStatus, ExtractedTableType } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseXlsxTablesForIndustry } from "@/lib/files/table-extraction-handler";
import { buildFurnitureCanonicalOutput } from "@/lib/furniture/canonical-output";
import {
  formatFurnitureJoineryLinearEdgeQuantity,
  FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
} from "@/lib/furniture/linear-edge-format";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  JOINERY_CUTTING_LIST_SECTION_TITLE,
  JOINERY_INDUSTRY_KEY,
} from "@/lib/furniture/types";

type StoredEntity = Record<string, any>;

const candidateStore = vi.hoisted(() => {
  const state = { entities: [] as StoredEntity[], nextId: 1 };

  function matches(row: StoredEntity, where: Record<string, any>): boolean {
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.projectFileId !== undefined && row.projectFileId !== where.projectFileId) return false;
    if (where.categoryKey?.in && !where.categoryKey.in.includes(row.categoryKey)) return false;
    if (where.categoryKey !== undefined && !where.categoryKey?.in && row.categoryKey !== where.categoryKey) return false;
    if (where.extractionMethod !== undefined && row.extractionMethod !== where.extractionMethod) return false;
    if (where.status?.in && !where.status.in.includes(row.status)) return false;
    return true;
  }

  const extractedEntity = {
    findMany: vi.fn(async ({ where }: { where: Record<string, any> }) =>
      state.entities.filter((row) => matches(row, where))),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const row = { id: `entity-${state.nextId++}`, ...data };
      state.entities.push(row);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const rows = state.entities.filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const before = state.entities.length;
      state.entities = state.entities.filter((row) => !matches(row, where));
      return { count: before - state.entities.length };
    }),
  };
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    extractedEntity,
  };
  const prisma = {
    drawingPage: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>, _options?: { timeout: number }) => operation(tx)),
  };
  return { state, extractedEntity, tx, prisma };
});

const projectRepository = vi.hoisted(() => ({ getProjectRecord: vi.fn() }));
const fileRepository = vi.hoisted(() => ({ getProjectFileRecord: vi.fn(), listProjectFiles: vi.fn() }));
const tableRepository = vi.hoisted(() => ({ listExtractedTablesForFile: vi.fn() }));
const entityRepository = vi.hoisted(() => ({ hasReviewedTableDerivedCandidates: vi.fn() }));
const auditRepository = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ prisma: candidateStore.prisma }));
vi.mock("@/lib/repositories/project-repository", () => projectRepository);
vi.mock("@/lib/repositories/project-file-repository", () => fileRepository);
vi.mock("@/lib/repositories/extracted-table-repository", () => tableRepository);
vi.mock("@/lib/repositories/extracted-entity-repository", () => entityRepository);
vi.mock("@/lib/repositories/audit-repository", () => auditRepository);

import { generateFurnitureCandidatesFromStructuredTables } from "@/lib/services/furniture-candidate-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

function decimal(value: number) {
  return { toNumber: () => value };
}

function sourceCells(part: string, edgeBanding = "All 4 edges") {
  return [
    ["room", "KITCHEN", "A5"],
    ["elevation_ref", "ELEV-A", "B5"],
    ["cabinet_unit", "Base cabinet", "C5"],
    ["part", part, "D5"],
    ["quantity", "2", "E5"],
    ["width_mm", "600", "F5"],
    ["height_mm", "720", "G5"],
    ["thickness_mm", "18", "H5"],
    ["material", "MDF (Oak)", "I5"],
    ["finish", "Oak", "J5"],
    ["edge_banding", edgeBanding, "K5"],
    ["grain_direction", "Vertical", "L5"],
  ].map(([columnKey, rawValue, reference], index) => ({
    id: `cell-${part}-${index}`,
    companyId: COMPANY_ID,
    extractedTableRowId: `row-${part}`,
    columnKey,
    rawValue,
    normalizedValue: null,
    confidence: decimal(95),
    sourceCellReference: `Cutting List!${reference}`,
    boundingGeometryJson: null,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
  }));
}

function table(id: string, part: string, edgeBanding = "All 4 edges", title = "Cutting List") {
  return {
    id,
    companyId: COMPANY_ID,
    projectFileId: FILE_ID,
    drawingPageId: null,
    sheetName: "Cutting List" as string | null,
    title,
    tableType: ExtractedTableType.FURNITURE_SCHEDULE,
    confidence: decimal(96),
    boundingGeometryJson: null,
    sourceReference: "Cutting List",
    status: ExtractedTableStatus.EXTRACTED,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
    rows: [{
      id: `row-${part}`,
      companyId: COMPANY_ID,
      extractedTableId: id,
      rowNumber: 5,
      parentRowId: null,
      normalizedDataJson: null,
      rawDataJson: null,
      confidence: decimal(95),
      status: ExtractedTableStatus.EXTRACTED,
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      updatedAt: new Date("2026-08-31T00:00:00.000Z"),
      cells: sourceCells(part, edgeBanding),
    }],
  };
}

function orderTable(id: string) {
  const orderCells = [
    ["description", "Soft-close concealed hinge", "A7"],
    ["quantity", "12", "B7"],
    ["unit", "pcs", "C7"],
    ["category", "HARDWARE", "D7"],
    ["notes", "For base cabinet doors", "E7"],
  ].map(([columnKey, rawValue, reference], index) => ({
    id: `order-cell-${index}`,
    companyId: COMPANY_ID,
    extractedTableRowId: "order-row",
    columnKey,
    rawValue,
    normalizedValue: null,
    confidence: decimal(94),
    sourceCellReference: `Hardware & Accessories BOQ!${reference}`,
    boundingGeometryJson: null,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
  }));
  return {
    id,
    companyId: COMPANY_ID,
    projectFileId: FILE_ID,
    drawingPageId: null,
    sheetName: "Hardware & Accessories BOQ",
    title: "Hardware & Accessories BOQ",
    tableType: ExtractedTableType.FURNITURE_SCHEDULE,
    confidence: decimal(94),
    boundingGeometryJson: null,
    sourceReference: "Hardware & Accessories BOQ",
    status: ExtractedTableStatus.EXTRACTED,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
    rows: [{
      id: "order-row",
      companyId: COMPANY_ID,
      extractedTableId: id,
      rowNumber: 7,
      parentRowId: null,
      normalizedDataJson: null,
      rawDataJson: null,
      confidence: decimal(94),
      status: ExtractedTableStatus.EXTRACTED,
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      updatedAt: new Date("2026-08-31T00:00:00.000Z"),
      cells: orderCells,
    }],
  };
}

function storedFixtureTable(parsed: any, tableIndex: number) {
  const createdAt = new Date("2026-08-31T00:00:00.000Z");
  return {
    id: `fixture-table-${tableIndex}`,
    companyId: COMPANY_ID,
    projectFileId: FILE_ID,
    drawingPageId: null,
    sheetName: parsed.sheetName ?? null,
    title: parsed.title ?? null,
    tableType: ExtractedTableType.FURNITURE_SCHEDULE,
    confidence: decimal(parsed.confidence),
    boundingGeometryJson: null,
    sourceReference: parsed.sheetName ?? parsed.title ?? "fixture",
    status: ExtractedTableStatus.EXTRACTED,
    createdAt,
    updatedAt: createdAt,
    rows: parsed.rows.map((row: any, rowIndex: number) => ({
      id: `fixture-row-${tableIndex}-${rowIndex}`,
      companyId: COMPANY_ID,
      extractedTableId: `fixture-table-${tableIndex}`,
      rowNumber: row.rowNumber,
      parentRowId: null,
      normalizedDataJson: null,
      rawDataJson: null,
      confidence: decimal(row.confidence),
      status: ExtractedTableStatus.EXTRACTED,
      createdAt,
      updatedAt: createdAt,
      cells: row.cells.map((cell: any, cellIndex: number) => ({
        id: `fixture-cell-${tableIndex}-${rowIndex}-${cellIndex}`,
        companyId: COMPANY_ID,
        extractedTableRowId: `fixture-row-${tableIndex}-${rowIndex}`,
        columnKey: cell.columnKey,
        rawValue: cell.rawValue,
        normalizedValue: cell.normalizedValue ?? null,
        confidence: decimal(row.confidence),
        sourceCellReference: cell.sourceCellReference ?? null,
        boundingGeometryJson: null,
        createdAt,
        updatedAt: createdAt,
      })),
    })),
  };
}

function candidateIdOf(row: StoredEntity): string {
  return row.technicalDataJson.candidate.candidateId as string;
}

describe("Furniture structured-source candidate persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    candidateStore.state.entities.splice(0);
    candidateStore.state.nextId = 1;
    projectRepository.getProjectRecord.mockResolvedValue({
      id: PROJECT_ID,
      industryEngine: { key: JOINERY_INDUSTRY_KEY },
    });
    fileRepository.getProjectFileRecord.mockResolvedValue({
      id: FILE_ID,
      projectId: PROJECT_ID,
      originalName: "controlled-cutting-list.xlsx",
      extension: "xlsx",
    });
    tableRepository.listExtractedTablesForFile.mockResolvedValue([
      table("table-a", "Door panel"),
      table("table-b", "Shelf"),
    ]);
    entityRepository.hasReviewedTableDerivedCandidates.mockResolvedValue(false);
    auditRepository.createAuditLog.mockResolvedValue(undefined);
  });

  it("keeps same-sheet/same-row tables distinct while preserving raw table and row evidence", async () => {
    const result = await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });

    expect(result).toMatchObject({ status: "generated", tablesConsidered: 2, rowsConsidered: 2, candidatesCreated: 2 });
    expect(candidateStore.state.entities).toHaveLength(2);
    const ids = candidateStore.state.entities.map(candidateIdOf);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toContain("Cutting List:0:5:0");
    expect(ids[1]).toContain("Cutting List:1:5:0");
    expect(candidateStore.state.entities.map((row) => row.technicalDataJson.candidate.evidence))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceTableId: "table-a", sourceRowId: "row-Door panel" }),
        expect.objectContaining({ sourceTableId: "table-b", sourceRowId: "row-Shelf" }),
      ]));
    expect(candidateStore.state.entities.every((row) =>
      row.categoryKey === FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND
      && row.status === ExtractedEntityStatus.NEEDS_REVIEW)).toBe(true);
    expect(candidateStore.prisma.$transaction.mock.calls[0]?.[1]).toEqual({ timeout: 120_000 });
  });

  it("ignores positional PDF rows with neither Joinery hierarchy nor order-item semantics", async () => {
    const noise = table("noise-table", "unused");
    noise.sheetName = null;
    noise.title = "Recovered table — page 2";
    noise.rows[0].cells = sourceCells("unused").slice(0, 3).map((cell, index) => ({
      ...cell,
      columnKey: `unrecognized_${index + 1}`,
      rawValue: ["01", "GROUND FLOOR", "SCALE 1:50"][index]!,
    }));
    tableRepository.listExtractedTablesForFile.mockResolvedValue([noise]);

    const result = await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });

    expect(result).toMatchObject({ status: "generated", candidatesCreated: 0 });
    expect(candidateStore.state.entities).toHaveLength(0);
  });

  it("is idempotent on replay and updates the same deterministic keys without duplicates", async () => {
    const input = { companyId: COMPANY_ID, projectId: PROJECT_ID, projectFileId: FILE_ID };
    const first = await generateFurnitureCandidatesFromStructuredTables(input);
    const firstIds = candidateStore.state.entities.map((row) => row.id);
    const firstKeys = candidateStore.state.entities.map(candidateIdOf);

    const replay = await generateFurnitureCandidatesFromStructuredTables(input);

    expect(first.candidatesCreated).toBe(2);
    expect(replay.candidatesCreated).toBe(0);
    expect(candidateStore.state.entities.map((row) => row.id)).toEqual(firstIds);
    expect(candidateStore.state.entities.map(candidateIdOf)).toEqual(firstKeys);
    expect(candidateStore.state.entities).toHaveLength(2);
    expect(candidateStore.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("replaces stale unreviewed candidates when structured source rows disappear", async () => {
    const input = { companyId: COMPANY_ID, projectId: PROJECT_ID, projectFileId: FILE_ID };
    await generateFurnitureCandidatesFromStructuredTables(input);
    const staleEntityId = candidateStore.state.entities.find(
      (row) => row.technicalDataJson.candidate.part === "Shelf",
    )?.id;

    tableRepository.listExtractedTablesForFile.mockResolvedValue([table("table-a", "Door panel")]);
    const replay = await generateFurnitureCandidatesFromStructuredTables(input);

    expect(replay).toMatchObject({ status: "generated", candidatesCreated: 0 });
    expect(candidateStore.state.entities).toHaveLength(1);
    expect(candidateStore.state.entities[0].technicalDataJson.candidate.part).toBe("Door panel");
    expect(candidateStore.extractedEntity.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: [staleEntityId] }, companyId: COMPANY_ID, projectFileId: FILE_ID }),
    });
    expect(auditRepository.createAuditLog).toHaveBeenLastCalledWith(
      COMPANY_ID,
      expect.objectContaining({ payload: expect.objectContaining({ candidatesRemoved: 1 }) }),
      candidateStore.tx,
    );
  });

  it("removes both part and order candidates when a replacement contains no structured rows", async () => {
    tableRepository.listExtractedTablesForFile.mockResolvedValue([
      table("table-parts", "Door panel"),
      orderTable("table-orders"),
    ]);
    const input = { companyId: COMPANY_ID, projectId: PROJECT_ID, projectFileId: FILE_ID };
    await generateFurnitureCandidatesFromStructuredTables(input);
    expect(candidateStore.state.entities).toHaveLength(2);

    tableRepository.listExtractedTablesForFile.mockResolvedValue([]);
    const replay = await generateFurnitureCandidatesFromStructuredTables(input);

    expect(replay).toMatchObject({ status: "generated", tablesConsidered: 0, rowsConsidered: 0, candidatesCreated: 0 });
    expect(candidateStore.state.entities).toEqual([]);
    expect(auditRepository.createAuditLog).toHaveBeenLastCalledWith(
      COMPANY_ID,
      expect.objectContaining({ payload: expect.objectContaining({ candidatesRemoved: 2 }) }),
      candidateStore.tx,
    );
  });

  it("carries the controlled workbook width-edge interpretation into the production candidate path", async () => {
    tableRepository.listExtractedTablesForFile.mockResolvedValue([
      table("table-front", "Door panel", "Front edge", JOINERY_CUTTING_LIST_SECTION_TITLE),
    ]);

    await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });

    const candidate = candidateStore.state.entities[0].technicalDataJson.candidate;
    expect(candidate.edgeBanding).toEqual({
      raw: "Front edge",
      mode: "FRONT",
      selectedEdges: [{ dimension: "WIDTH", count: 1 }],
      orientation: "ASSUMED",
    });
    expect(candidate.issues).toContainEqual(expect.objectContaining({
      code: "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
      severity: "REVIEW",
    }));
  });

  it("does not apply the controlled width-edge interpretation to a generic workbook table", async () => {
    tableRepository.listExtractedTablesForFile.mockResolvedValue([
      table("generic-front", "Door panel", "Front edge"),
    ]);

    await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });

    expect(candidateStore.state.entities[0].technicalDataJson.candidate.edgeBanding).toEqual({
      raw: "Front edge",
      mode: "FRONT",
      selectedEdges: [],
      orientation: "UNRESOLVED",
    });
  });

  it("carries the Madam Juli fixture through the production table and candidate path at exactly 93.040 lm", async () => {
    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      "furniture",
      "Madam_Juli_BOQ_Cutting_List.xlsx",
    );
    const parsed = await parseXlsxTablesForIndustry(await readFile(fixturePath), JOINERY_INDUSTRY_KEY);
    tableRepository.listExtractedTablesForFile.mockResolvedValue(parsed.map(storedFixtureTable));
    fileRepository.getProjectFileRecord.mockResolvedValue({
      id: FILE_ID,
      projectId: PROJECT_ID,
      originalName: "Madam_Juli_BOQ_Cutting_List.xlsx",
      extension: "xlsx",
    });

    const result = await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });
    const partRows = candidateStore.state.entities.filter(
      (row) => row.categoryKey === FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
    );
    expect(result).toMatchObject({ status: "generated", tablesConsidered: 2, rowsConsidered: 167 });
    expect(partRows).toHaveLength(155);

    const timestamp = "2026-08-31T00:00:00.000Z";
    const output = buildFurnitureCanonicalOutput({
      projectId: PROJECT_ID,
      projectReference: "MADAM-JULI",
      projectName: "Madam Juli",
      discipline: "JOINERY_CABINETRY",
      wastagePercentage: 10,
      confirmedCandidates: partRows.map((row) => ({
        entityId: row.id,
        status: "CONFIRMED" as const,
        confirmedAt: timestamp,
        updatedAt: timestamp,
        candidate: row.technicalDataJson.candidate,
      })),
    });
    const edge = output.sections
      .find((section) => section.code === "HWA")
      ?.items.find((item) => item.description === "Front-edge banding length");

    expect(edge?.quantity).toBeCloseTo(93.04, 6);
    expect(formatFurnitureJoineryLinearEdgeQuantity(edge!.quantity)).toBe("93.040");
    expect(edge).toMatchObject({
      unit: "lm",
      specification: FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
      notes: FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE,
    });
  });

  it("stores explicit hardware rows under the order marker with stable evidence instead of flattening them into parts", async () => {
    tableRepository.listExtractedTablesForFile.mockResolvedValue([
      table("table-parts", "Door panel"),
      orderTable("table-orders"),
    ]);
    const input = { companyId: COMPANY_ID, projectId: PROJECT_ID, projectFileId: FILE_ID };

    const first = await generateFurnitureCandidatesFromStructuredTables(input);
    const partRow = candidateStore.state.entities.find(
      (row) => row.categoryKey === FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
    );
    const orderRow = candidateStore.state.entities.find(
      (row) => row.categoryKey === FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
    );

    expect(first).toMatchObject({ candidatesCreated: 2, tablesConsidered: 2, rowsConsidered: 2 });
    expect(partRow?.technicalDataJson).toMatchObject({
      kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      candidate: { part: "Door panel" },
    });
    expect(orderRow).toMatchObject({
      categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      label: "Soft-close concealed hinge",
      quantity: 12,
      unit: "pcs",
      status: ExtractedEntityStatus.NEEDS_REVIEW,
    });
    expect(orderRow?.technicalDataJson).toMatchObject({
      kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      candidate: {
        description: "Soft-close concealed hinge",
        category: "HARDWARE",
        evidence: {
          sourceFileId: FILE_ID,
          sourceTableId: "table-orders",
          sourceRowId: "order-row",
          sourceTableKey: "Hardware & Accessories BOQ:1",
          sourceRowKey: "7:0",
          sourceCellReferences: expect.arrayContaining([
            "Hardware & Accessories BOQ!A7",
            "Hardware & Accessories BOQ!B7",
          ]),
        },
      },
    });
    expect(orderRow?.technicalDataJson.candidate).not.toHaveProperty("part");
    const storedId = orderRow?.id;
    const storedCandidateId = orderRow?.technicalDataJson.candidate.id;

    const replay = await generateFurnitureCandidatesFromStructuredTables(input);

    const replayedOrderRows = candidateStore.state.entities.filter(
      (row) => row.categoryKey === FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
    );
    expect(replay).toMatchObject({ candidatesCreated: 0 });
    expect(replayedOrderRows).toHaveLength(1);
    expect(replayedOrderRows[0]).toMatchObject({ id: storedId });
    expect(replayedOrderRows[0].technicalDataJson.candidate.id).toBe(storedCandidateId);
  });

  it("checks all managed statuses inside the file lock and skips a newly corrected row", async () => {
    await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });
    candidateStore.state.entities[0].status = ExtractedEntityStatus.CORRECTED;
    vi.clearAllMocks();
    entityRepository.hasReviewedTableDerivedCandidates.mockResolvedValue(false);
    auditRepository.createAuditLog.mockResolvedValue(undefined);

    const result = await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });

    expect(result).toMatchObject({ status: "skipped", candidatesCreated: 0 });
    expect(candidateStore.state.entities).toHaveLength(2);
    expect(candidateStore.extractedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ status: expect.anything() }),
    }));
    expect(candidateStore.extractedEntity.create).not.toHaveBeenCalled();
    expect(candidateStore.extractedEntity.updateMany).not.toHaveBeenCalled();
    expect(candidateStore.extractedEntity.deleteMany).not.toHaveBeenCalled();
    expect(auditRepository.createAuditLog).not.toHaveBeenCalled();
  });

  it("fails closed when legacy duplicate candidate keys are already present", async () => {
    await generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    });
    candidateStore.state.entities.push({
      ...candidateStore.state.entities[0],
      id: "legacy-duplicate",
    });
    vi.clearAllMocks();
    entityRepository.hasReviewedTableDerivedCandidates.mockResolvedValue(false);

    await expect(generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    })).rejects.toMatchObject({
      code: "FURNITURE_CANDIDATE_INTEGRITY_ERROR",
      status: 409,
    });
    expect(candidateStore.extractedEntity.create).not.toHaveBeenCalled();
    expect(candidateStore.extractedEntity.updateMany).not.toHaveBeenCalled();
  });

  it("rejects non-Joinery industries and cross-project files before persistence", async () => {
    projectRepository.getProjectRecord.mockResolvedValueOnce({
      id: PROJECT_ID,
      industryEngine: { key: "furniture" },
    });
    await expect(generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    })).rejects.toMatchObject({ code: "FURNITURE_PROJECT_REQUIRED", status: 400 });

    projectRepository.getProjectRecord.mockResolvedValueOnce({
      id: PROJECT_ID,
      industryEngine: { key: JOINERY_INDUSTRY_KEY },
    });
    fileRepository.getProjectFileRecord.mockResolvedValueOnce({
      id: FILE_ID,
      projectId: "another-project",
      originalName: "wrong-project.xlsx",
      extension: "xlsx",
    });
    await expect(generateFurnitureCandidatesFromStructuredTables({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      projectFileId: FILE_ID,
    })).rejects.toMatchObject({ code: "FILE_PROJECT_MISMATCH", status: 400 });
    expect(candidateStore.extractedEntity.create).not.toHaveBeenCalled();
  });
});
