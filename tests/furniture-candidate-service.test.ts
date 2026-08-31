import { ExtractedEntityStatus, ExtractedTableStatus, ExtractedTableType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
} from "@/lib/furniture/types";

type StoredEntity = Record<string, any>;

const candidateStore = vi.hoisted(() => {
  const state = { entities: [] as StoredEntity[], nextId: 1 };

  function matches(row: StoredEntity, where: Record<string, any>): boolean {
    if (where.id !== undefined && row.id !== where.id) return false;
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
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    extractedEntity,
  };
  const prisma = {
    drawingPage: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { state, extractedEntity, tx, prisma };
});

const projectRepository = vi.hoisted(() => ({ getProjectRecord: vi.fn() }));
const fileRepository = vi.hoisted(() => ({ getProjectFileRecord: vi.fn(), listProjectFiles: vi.fn() }));
const tableRepository = vi.hoisted(() => ({ listExtractedTablesForFile: vi.fn() }));
const entityRepository = vi.hoisted(() => ({ hasReviewedTableDerivedCandidates: vi.fn() }));
const disciplineService = vi.hoisted(() => ({ getFurnitureProjectDiscipline: vi.fn() }));
const auditRepository = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ prisma: candidateStore.prisma }));
vi.mock("@/lib/repositories/project-repository", () => projectRepository);
vi.mock("@/lib/repositories/project-file-repository", () => fileRepository);
vi.mock("@/lib/repositories/extracted-table-repository", () => tableRepository);
vi.mock("@/lib/repositories/extracted-entity-repository", () => entityRepository);
vi.mock("@/lib/furniture/project-discipline", () => disciplineService);
vi.mock("@/lib/repositories/audit-repository", () => auditRepository);

import { generateFurnitureCandidatesFromStructuredTables } from "@/lib/services/furniture-candidate-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

function decimal(value: number) {
  return { toNumber: () => value };
}

function sourceCells(part: string) {
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
    ["edge_banding", "All 4 edges", "K5"],
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

function table(id: string, part: string) {
  return {
    id,
    companyId: COMPANY_ID,
    projectFileId: FILE_ID,
    drawingPageId: null,
    sheetName: "Cutting List",
    title: "Cutting List",
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
      cells: sourceCells(part),
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
      industryEngine: { key: "furniture-joinery-cabinetry" },
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
    disciplineService.getFurnitureProjectDiscipline.mockResolvedValue("JOINERY_CABINETRY");
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
    expect(candidateStore.tx.$queryRaw).toHaveBeenCalledTimes(2);
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

  it("rejects non-combined industries and cross-project files before persistence", async () => {
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
      industryEngine: { key: "furniture-joinery-cabinetry" },
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
