import { ExtractedEntityStatus, ExtractedEntityType, ExtractionMethod, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import type { FurniturePartCandidate } from "@/lib/furniture/candidate-mapper";
import type { FurnitureOrderItemCandidate } from "@/lib/furniture/order-item-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
} from "@/lib/furniture/types";

type StoredEntity = Record<string, any>;

const entityStore = vi.hoisted(() => {
  const state = { rows: [] as StoredEntity[] };

  function matches(row: StoredEntity, where: Record<string, any>): boolean {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.projectId !== undefined && row.projectId !== where.projectId) return false;
    if (where.categoryKey !== undefined && row.categoryKey !== where.categoryKey) return false;
    if (where.status?.in && !where.status.in.includes(row.status)) return false;
    return true;
  }

  const extractedEntity = {
    findMany: vi.fn(async ({ where }: { where: Record<string, any> }) =>
      state.rows.filter((row) => matches(row, where))),
    findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) =>
      state.rows.find((row) => matches(row, where)) ?? null),
    findFirstOrThrow: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const row = state.rows.find((candidate) => matches(candidate, where));
      if (!row) throw new Error("Mock row not found");
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const rows = state.rows.filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    }),
  };

  const tx = { extractedEntity };
  const prisma = {
    extractedEntity,
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { state, extractedEntity, tx, prisma };
});

const projectRepository = vi.hoisted(() => ({ getProjectRecord: vi.fn() }));
const auditRepository = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
const extractedEntityRepository = vi.hoisted(() => ({
  createExtractedEntity: vi.fn(),
  listExtractedEntities: vi.fn(),
  toExtractedEntityDTO: vi.fn((row: StoredEntity) => ({ ...row })),
}));
const projectFileRepository = vi.hoisted(() => ({ getProjectFileRecord: vi.fn() }));
const boqRepository = vi.hoisted(() => ({
  createPreparedBOQItem: vi.fn(),
  getBOQ: vi.fn(),
  getBOQRecord: vi.fn(),
  prepareBOQItemCreation: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: entityStore.prisma }));
vi.mock("@/lib/repositories/project-repository", () => projectRepository);
vi.mock("@/lib/repositories/audit-repository", () => auditRepository);
vi.mock("@/lib/repositories/extracted-entity-repository", () => extractedEntityRepository);
vi.mock("@/lib/repositories/project-file-repository", () => projectFileRepository);
vi.mock("@/lib/repositories/boq-repository", () => boqRepository);
vi.mock("@/lib/services/estimate-integrity-service", () => ({
  recordReviewedExtractionQuantity: vi.fn(),
}));

import {
  approveFurnitureCandidate,
  correctFurnitureCandidate,
  listFurnitureCandidates,
} from "@/lib/services/furniture-review-service";
import {
  approveFurnitureOrderItemCandidate,
  correctFurnitureOrderItemCandidate,
  listFurnitureOrderItemCandidates,
} from "@/lib/services/furniture-order-review-service";
import {
  confirmExtractedEntity,
  correctExtractedEntity,
  rejectExtractedEntity,
} from "@/lib/services/extracted-entity-service";
import { importExtractedEntityToBoq } from "@/lib/services/extraction-to-boq-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "33333333-3333-4333-8333-333333333333";
const PROJECT_OTHER = "44444444-4444-4444-8444-444444444444";
const FILE_A = "55555555-5555-4555-8555-555555555555";
const ENTITY_A = "66666666-6666-4666-8666-666666666666";

function actor(role: UserRole = UserRole.COMPANY_OWNER, companyId = COMPANY_A): CurrentActor {
  return {
    userId: `${companyId.slice(0, 8)}-7777-4777-8777-777777777777`,
    companyId,
    role,
    fullName: "Furniture Reviewer",
    email: "reviewer@example.test",
  };
}

function reading(valueMm: number | null, hasConflict = false) {
  return {
    valueMm,
    readings: [{
      columnKey: "source",
      rawValue: valueMm === null ? "" : String(valueMm),
      valueMm,
      evidenceReference: "Cutting List!F5",
    }],
    hasConflict,
  };
}

function candidate(overrides: Partial<FurniturePartCandidate> = {}): FurniturePartCandidate {
  const base = {
    candidateId: `${FILE_A}:table-a:row-a`,
    mappingVersion: "furniture-candidate-v1",
    discipline: "JOINERY_CABINETRY",
    room: "KITCHEN",
    elevationReference: "ELEV-A",
    assembly: "Base cabinet",
    assemblyGroupKey: "kitchen|elev-a|base-cabinet",
    part: "Door panel",
    quantity: 2,
    dimensions: {
      width: reading(600),
      height: reading(720),
      depth: reading(null),
      thickness: reading(18),
    },
    material: { raw: "MDF (Oak)", name: "MDF", finish: "Oak" },
    edgeBanding: {
      raw: "All 4 edges",
      mode: "ALL_FOUR",
      selectedEdges: [
        { dimension: "WIDTH", count: 2 },
        { dimension: "HEIGHT", count: 2 },
      ],
      orientation: "EXPLICIT",
    },
    grainDirection: "Vertical",
    hardwareNotes: [],
    notes: null,
    evidence: {
      sourceFileId: FILE_A,
      sourceFileName: "controlled-cutting-list.xlsx",
      sourceKind: "WORKBOOK",
      method: "TABLE_PARSER",
      sourceTableId: "table-a",
      sourceRowId: "row-a",
      sheetName: "Cutting List",
      pageNumber: null,
      rowNumber: 5,
      drawingReference: "ELEV-A",
      confidence: 96,
      sourceCellReferences: ["Cutting List!A5", "Cutting List!F5"],
      rawCells: { room: "KITCHEN", width_mm: "600" },
    },
    issues: [],
    verificationStatus: "READY_FOR_REVIEW",
  };
  return { ...base, ...overrides } as FurniturePartCandidate;
}

function furnitureRow(input: {
  id?: string;
  companyId?: string;
  projectId?: string;
  status?: ExtractedEntityStatus;
  candidate?: FurniturePartCandidate;
  categoryKey?: string | null;
} = {}): StoredEntity {
  const value = input.candidate ?? candidate();
  return {
    id: input.id ?? ENTITY_A,
    companyId: input.companyId ?? COMPANY_A,
    projectId: input.projectId ?? PROJECT_A,
    projectFileId: FILE_A,
    entityType: ExtractedEntityType.FURNITURE,
    categoryKey: input.categoryKey === undefined
      ? FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND
      : input.categoryKey,
    label: value.part,
    normalizedLabel: value.part.toLowerCase(),
    quantity: value.quantity,
    unit: "pcs",
    confidence: { toNumber: () => 96 },
    extractionMethod: ExtractionMethod.TABLE_PARSER,
    sourceText: "source evidence",
    sourceReference: "controlled-cutting-list.xlsx · Cutting List · row 5",
    technicalDataJson: {
      kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      candidate: value,
    },
    status: input.status ?? ExtractedEntityStatus.NEEDS_REVIEW,
    correctionJson: null,
    confirmedByUserId: null,
    confirmedAt: null,
    rejectedByUserId: null,
    rejectedAt: null,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
  };
}

function currentCandidate(row: StoredEntity): FurniturePartCandidate {
  return row.technicalDataJson.candidate as FurniturePartCandidate;
}

function orderCandidate(overrides: Partial<FurnitureOrderItemCandidate> = {}): FurnitureOrderItemCandidate {
  return {
    id: "furniture-order-item-v1:Hardware%20%26%20Accessories%20BOQ%3A0:7%3A0",
    description: "Soft-close concealed hinge",
    quantity: 12,
    quantityText: "12",
    unit: null,
    category: "UNCLASSIFIED",
    suppliedByOthers: false,
    notes: "Base cabinet doors",
    mappingVersion: "furniture-order-item-v1",
    verificationStatus: "NEEDS_REVIEW",
    issues: [
      {
        code: "MISSING_UNIT",
        field: "unit",
        severity: "REVIEW",
        message: "Confirm the ordering unit before approval.",
        evidenceReferences: [],
      },
      {
        code: "CATEGORY_REQUIRES_REVIEW",
        field: "category",
        severity: "REVIEW",
        message: "Select an explicit order category before approval.",
        evidenceReferences: ["Hardware & Accessories BOQ!A7"],
      },
    ],
    evidence: {
      sheetName: "Hardware & Accessories BOQ",
      rowNumber: 7,
      sourceCellReferences: ["Hardware & Accessories BOQ!A7", "Hardware & Accessories BOQ!B7"],
      sourceTableId: "order-table-a",
      sourceRowId: "order-row-a",
      sourceFileId: FILE_A,
      sourceFileName: "controlled-cutting-list.xlsx",
      sourceKind: "WORKBOOK",
      pageNumber: null,
      confidence: 94,
      method: "TABLE_PARSER",
      sourceTableKey: "Hardware & Accessories BOQ:0",
      sourceRowKey: "7:0",
      rawCells: { description: "Soft-close concealed hinge", quantity: "12" },
    },
    ...overrides,
  };
}

function orderRow(input: {
  id?: string;
  companyId?: string;
  projectId?: string;
  status?: ExtractedEntityStatus;
  candidate?: FurnitureOrderItemCandidate;
} = {}): StoredEntity {
  const value = input.candidate ?? orderCandidate();
  return {
    ...furnitureRow({
      id: input.id,
      companyId: input.companyId,
      projectId: input.projectId,
      status: input.status,
      categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
    }),
    label: value.description,
    normalizedLabel: value.description.toLowerCase(),
    quantity: value.quantity,
    unit: value.unit,
    technicalDataJson: {
      kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      candidate: value,
    },
  };
}

describe("Furniture professional-review isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityStore.state.rows.splice(0);
    projectRepository.getProjectRecord.mockImplementation(async (companyId: string, identifier: string) => {
      if (companyId !== COMPANY_A) {
        throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND", status: 404 });
      }
      return {
        id: identifier === "other-project" ? PROJECT_OTHER : PROJECT_A,
        slug: identifier,
        industryEngine: { key: "joinery" },
      };
    });
    auditRepository.createAuditLog.mockResolvedValue(undefined);
  });

  it("allows an authorized reviewer to read while keeping results tenant/project scoped", async () => {
    entityStore.state.rows.push(
      furnitureRow(),
      furnitureRow({ id: "77777777-7777-4777-8777-777777777777", projectId: PROJECT_OTHER }),
      furnitureRow({ id: "88888888-8888-4888-8888-888888888888", companyId: COMPANY_B }),
    );

    const rows = await listFurnitureCandidates(actor(UserRole.REVIEWER), "project-a");

    expect(rows.map((row) => row.id)).toEqual([ENTITY_A]);
    expect(entityStore.extractedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: COMPANY_A, projectId: PROJECT_A }),
    }));
  });

  it("persists a correction chain as CORRECTED without discarding immutable source evidence", async () => {
    const original = furnitureRow();
    const originalEvidence = structuredClone(currentCandidate(original).evidence);
    entityStore.state.rows.push(original);

    const result = await correctFurnitureCandidate(actor(), "project-a", ENTITY_A, {
      dimensions: { width: 610 },
      finish: "Walnut",
      reason: "Checked against signed cutting schedule A-401.",
    });

    expect(result.status).toBe(ExtractedEntityStatus.CORRECTED);
    expect(result.candidate.dimensions.width.valueMm).toBe(610);
    expect(result.candidate.dimensions.width.readings).toEqual(candidate().dimensions.width.readings);
    expect(result.candidate.evidence).toEqual(originalEvidence);
    expect(original.correctionJson).toMatchObject({
      reason: "Checked against signed cutting schedule A-401.",
      original: { evidence: originalEvidence },
      corrected: { evidence: originalEvidence },
    });
    expect(auditRepository.createAuditLog).toHaveBeenCalledWith(
      COMPANY_A,
      expect.objectContaining({ action: "FURNITURE_CANDIDATE_CORRECTED", entityId: ENTITY_A }),
      entityStore.tx,
    );

    const firstCorrection = structuredClone(original.correctionJson);
    const second = await correctFurnitureCandidate(actor(), "project-a", ENTITY_A, {
      dimensions: { height: 730 },
      reason: "Second check against the approved fabrication schedule.",
    });
    expect(second.status).toBe(ExtractedEntityStatus.CORRECTED);
    expect(second.candidate.dimensions.height.valueMm).toBe(730);
    expect(original.correctionJson).toMatchObject({
      reason: "Second check against the approved fabrication schedule.",
      previous: firstCorrection,
      original: { evidence: originalEvidence },
      corrected: { evidence: originalEvidence },
    });
  });

  it("blocks approval when a required dimension is missing or conflicting", async () => {
    const blocked = candidate({
      dimensions: {
        ...candidate().dimensions,
        width: reading(600, true),
        height: reading(null),
      },
    });
    entityStore.state.rows.push(furnitureRow({ candidate: blocked }));

    await expect(approveFurnitureCandidate(actor(), "project-a", ENTITY_A)).rejects.toMatchObject({
      code: "FURNITURE_VERIFICATION_BLOCKED",
      status: 409,
      fieldErrors: {
        issues: expect.arrayContaining(["DIMENSION_CONFLICT", "MISSING_DIMENSION"]),
      },
    });
    expect(entityStore.extractedEntity.updateMany).not.toHaveBeenCalled();
  });

  it("requires review acknowledgements, approves exactly once, and locks later edits", async () => {
    const reviewCandidate = candidate({
      material: { raw: "MDF (finish TBD)", name: "MDF", finish: "finish TBD" },
      grainDirection: null,
      edgeBanding: { raw: "Front edge", mode: "UNRESOLVED", selectedEdges: [], orientation: "UNRESOLVED" },
      issues: [],
      verificationStatus: "NEEDS_REVIEW",
    });
    const row = furnitureRow({ candidate: reviewCandidate });
    entityStore.state.rows.push(row);

    await expect(approveFurnitureCandidate(actor(), "project-a", ENTITY_A)).rejects.toMatchObject({
      code: "FURNITURE_ISSUES_REQUIRE_ACKNOWLEDGEMENT",
      status: 409,
    });

    const acknowledged = [
      "FINISH_REQUIRES_VERIFICATION",
      "GRAIN_DIRECTION_MISSING",
      "MISSING_EDGE_SELECTION",
      "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
    ];
    const approved = await approveFurnitureCandidate(actor(), "project-a", ENTITY_A, acknowledged);
    const replay = await approveFurnitureCandidate(actor(), "project-a", ENTITY_A, acknowledged);

    expect(approved.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(replay.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(row.confirmedByUserId).toBe(actor().userId);
    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect(auditRepository.createAuditLog.mock.calls.filter(([, entry]) =>
      entry.action === "FURNITURE_DIMENSIONS_APPROVED_AND_LOCKED")).toHaveLength(1);
    await expect(correctFurnitureCandidate(actor(), "project-a", ENTITY_A, {
      quantity: 3,
      reason: "Attempt after approval.",
    })).rejects.toMatchObject({ code: "FURNITURE_VALUES_LOCKED", status: 409 });
  });

  it("keeps an editable selected-edge assumption reviewable through approval", async () => {
    const assumed = candidate({
      edgeBanding: {
        raw: "Front edge",
        mode: "FRONT",
        selectedEdges: [{ dimension: "WIDTH", count: 1 }],
        orientation: "ASSUMED",
      },
      issues: [],
      verificationStatus: "NEEDS_REVIEW",
    });
    const row = furnitureRow({ candidate: assumed });
    entityStore.state.rows.push(row);

    await expect(approveFurnitureCandidate(actor(), "project-a", ENTITY_A)).rejects.toMatchObject({
      code: "FURNITURE_ISSUES_REQUIRE_ACKNOWLEDGEMENT",
      fieldErrors: { issues: ["EDGE_ORIENTATION_REQUIRES_VERIFICATION"] },
    });

    const approved = await approveFurnitureCandidate(actor(), "project-a", ENTITY_A, [
      "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
    ]);
    expect(approved.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(approved.candidate.edgeBanding.orientation).toBe("ASSUMED");
    expect(approved.candidate.issues).toContainEqual(expect.objectContaining({
      code: "EDGE_ORIENTATION_REQUIRES_VERIFICATION",
      severity: "REVIEW",
    }));
  });

  it("fails closed for cross-project, cross-tenant, and missing-capability mutations", async () => {
    const row = furnitureRow();
    entityStore.state.rows.push(row);

    await expect(correctFurnitureCandidate(actor(), "other-project", ENTITY_A, {
      quantity: 3,
      reason: "Wrong project attempt.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(correctFurnitureCandidate(actor(UserRole.REVIEWER, COMPANY_B), "project-a", ENTITY_A, {
      quantity: 3,
      reason: "Wrong tenant attempt.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(correctFurnitureCandidate(actor(UserRole.ESTIMATOR), "project-a", ENTITY_A, {
      quantity: 3,
      reason: "Unauthorized role attempt.",
    })).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
    expect(row.quantity).toBe(2);
    expect(row.status).toBe(ExtractedEntityStatus.NEEDS_REVIEW);
  });

  it("prevents every generic review action from flattening a managed furniture candidate", async () => {
    const row = furnitureRow();
    entityStore.state.rows.push(row);

    await expect(confirmExtractedEntity(actor(), ENTITY_A)).rejects.toMatchObject({
      code: "FURNITURE_REVIEW_REQUIRED",
      status: 409,
    });
    await expect(correctExtractedEntity(actor(), ENTITY_A, {
      label: "Flattened furniture row",
      quantity: 99,
      unit: "item",
      reason: "Generic correction attempt",
    })).rejects.toMatchObject({ code: "FURNITURE_REVIEW_REQUIRED", status: 409 });
    await expect(rejectExtractedEntity(actor(), ENTITY_A, "Generic rejection attempt"))
      .rejects.toMatchObject({ code: "FURNITURE_REVIEW_REQUIRED", status: 409 });
    expect(row.status).toBe(ExtractedEntityStatus.NEEDS_REVIEW);
    expect(currentCandidate(row).evidence.sourceCellReferences).toEqual(["Cutting List!A5", "Cutting List!F5"]);
  });

  it("prevents generic review and import paths from flattening a managed hardware/order item", async () => {
    const row = orderRow();
    entityStore.state.rows.push(row);

    await expect(confirmExtractedEntity(actor(), ENTITY_A)).rejects.toMatchObject({
      code: "FURNITURE_REVIEW_REQUIRED",
      status: 409,
    });
    await expect(correctExtractedEntity(actor(), ENTITY_A, {
      label: "Flattened hardware row",
      quantity: 99,
      unit: "item",
      reason: "Generic correction attempt",
    })).rejects.toMatchObject({ code: "FURNITURE_REVIEW_REQUIRED", status: 409 });
    await expect(rejectExtractedEntity(actor(), ENTITY_A, "Generic rejection attempt"))
      .rejects.toMatchObject({ code: "FURNITURE_REVIEW_REQUIRED", status: 409 });

    row.status = ExtractedEntityStatus.CONFIRMED;
    row.confirmedAt = new Date("2026-08-31T01:00:00.000Z");
    await expect(importExtractedEntityToBoq(actor(), "boq-1", ENTITY_A, {
      sectionId: "section-1",
      itemNumber: 1,
      itemCode: "HWA-001",
      category: "Hardware",
      description: "Soft-close concealed hinge",
      unit: "pcs",
      quantity: 12,
      unitCost: 0,
      marginPercentage: 0,
    })).rejects.toMatchObject({ code: "FURNITURE_MANAGED_BOQ_REQUIRED", status: 409 });
    expect(row.technicalDataJson.candidate).not.toHaveProperty("part");
    expect(row.technicalDataJson.candidate.evidence.sourceCellReferences)
      .toEqual(["Hardware & Accessories BOQ!A7", "Hardware & Accessories BOQ!B7"]);
    expect(boqRepository.createPreparedBOQItem).not.toHaveBeenCalled();
  });

  it("keeps the non-furniture review path unchanged", async () => {
    const generic = furnitureRow({ categoryKey: null });
    generic.entityType = ExtractedEntityType.MATERIAL;
    generic.technicalDataJson = null;
    entityStore.state.rows.push(generic);

    const confirmed = await confirmExtractedEntity(actor(), ENTITY_A);

    expect(confirmed.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(auditRepository.createAuditLog).toHaveBeenCalledWith(
      COMPANY_A,
      expect.objectContaining({ action: "ENTITY_CONFIRMED", entityId: ENTITY_A }),
      entityStore.tx,
    );
  });

  it("blocks the generic extraction-to-BOQ importer before any BOQ write", async () => {
    entityStore.state.rows.push(furnitureRow({ status: ExtractedEntityStatus.CONFIRMED }));

    await expect(importExtractedEntityToBoq(actor(), "boq-1", ENTITY_A, {
      sectionId: "section-1",
      itemNumber: 1,
      itemCode: "F-001",
      category: "Furniture",
      description: "Door panel",
      unit: "pcs",
      quantity: 2,
      unitCost: 0,
      marginPercentage: 0,
    })).rejects.toMatchObject({ code: "FURNITURE_MANAGED_BOQ_REQUIRED", status: 409 });
    expect(boqRepository.getBOQRecord).not.toHaveBeenCalled();
    expect(boqRepository.createPreparedBOQItem).not.toHaveBeenCalled();
  });

  it("keeps hardware/order review tenant-scoped and requires verification capability", async () => {
    entityStore.state.rows.push(
      orderRow(),
      orderRow({ id: "99999999-9999-4999-8999-999999999999", projectId: PROJECT_OTHER }),
      orderRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", companyId: COMPANY_B }),
    );

    const rows = await listFurnitureOrderItemCandidates(actor(UserRole.REVIEWER), "project-a");

    expect(rows.map((row) => row.id)).toEqual([ENTITY_A]);
    expect(entityStore.extractedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId: COMPANY_A,
        projectId: PROJECT_A,
        categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      },
    }));
    await expect(listFurnitureOrderItemCandidates(actor(UserRole.ESTIMATOR), "project-a"))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
  });

  it("preserves order evidence through correction, acknowledgement, idempotent approval and locking", async () => {
    const row = orderRow();
    const originalEvidence = structuredClone(row.technicalDataJson.candidate.evidence);
    entityStore.state.rows.push(row);

    await expect(approveFurnitureOrderItemCandidate(actor(), "project-a", ENTITY_A))
      .rejects.toMatchObject({
        code: "FURNITURE_ORDER_VERIFICATION_BLOCKED",
        status: 409,
        fieldErrors: {
          issues: expect.arrayContaining(["MISSING_UNIT", "CATEGORY_REQUIRES_REVIEW"]),
        },
      });

    const corrected = await correctFurnitureOrderItemCandidate(actor(), "project-a", ENTITY_A, {
      description: "Soft-close concealed hinge, 110 degree",
      quantity: 14,
      unit: "pcs",
      category: "HARDWARE",
      notes: "Count checked against the signed hardware schedule.",
      reason: "Verified schedule H-07 against the issued joinery package.",
    });

    expect(corrected.status).toBe(ExtractedEntityStatus.CORRECTED);
    expect(corrected.candidate).toMatchObject({
      description: "Soft-close concealed hinge, 110 degree",
      quantity: 14,
      quantityText: "14",
      unit: "pcs",
      category: "HARDWARE",
      evidence: originalEvidence,
    });
    expect(row.correctionJson).toMatchObject({
      reason: "Verified schedule H-07 against the issued joinery package.",
      original: { evidence: originalEvidence },
      corrected: { evidence: originalEvidence },
    });

    const acknowledgements = ["MISSING_UNIT", "CATEGORY_REQUIRES_REVIEW"];
    const approved = await approveFurnitureOrderItemCandidate(
      actor(),
      "project-a",
      ENTITY_A,
      acknowledgements,
    );
    const replay = await approveFurnitureOrderItemCandidate(
      actor(),
      "project-a",
      ENTITY_A,
      acknowledgements,
    );

    expect(approved.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(approved.candidate.verificationStatus).toBe("APPROVED_LOCKED");
    expect(replay.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(row.correctionJson).toMatchObject({ acknowledgedIssueCodes: acknowledgements });
    expect(auditRepository.createAuditLog.mock.calls.filter(([, entry]) =>
      entry.action === "FURNITURE_ORDER_ITEM_APPROVED_AND_LOCKED")).toHaveLength(1);
    await expect(correctFurnitureOrderItemCandidate(actor(), "project-a", ENTITY_A, {
      quantity: 15,
      reason: "Attempted edit after approval.",
    })).rejects.toMatchObject({ code: "FURNITURE_VALUES_LOCKED", status: 409 });
    expect(row.technicalDataJson.candidate.evidence).toEqual(originalEvidence);
  });

  it("fails order mutations closed across project and tenant boundaries", async () => {
    const row = orderRow();
    entityStore.state.rows.push(row);

    await expect(correctFurnitureOrderItemCandidate(actor(), "other-project", ENTITY_A, {
      quantity: 13,
      reason: "Wrong project attempt.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(correctFurnitureOrderItemCandidate(actor(UserRole.REVIEWER, COMPANY_B), "project-a", ENTITY_A, {
      quantity: 13,
      reason: "Wrong tenant attempt.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(correctFurnitureOrderItemCandidate(actor(UserRole.ESTIMATOR), "project-a", ENTITY_A, {
      quantity: 13,
      reason: "Unauthorized role attempt.",
    })).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
    expect(row.status).toBe(ExtractedEntityStatus.NEEDS_REVIEW);
    expect(row.quantity).toBe(12);
  });
});
