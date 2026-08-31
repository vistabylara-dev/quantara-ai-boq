import {
  BOQStatus,
  ExtractedEntityStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import type { FurniturePartCandidate } from "@/lib/furniture/candidate-mapper";
import type { FurnitureOrderItemCandidate } from "@/lib/furniture/order-item-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  JOINERY_INDUSTRY_KEY,
} from "@/lib/furniture/types";

const mocks = vi.hoisted(() => ({
  buildFurnitureCanonicalOutput: vi.fn(),
  getProjectRecord: vi.fn(),
  createAuditLog: vi.fn(),
  recordReviewedExtractionQuantity: vi.fn(),
  confirmManualQuantityProvenance: vi.fn(),
}));

const managedStore = vi.hoisted(() => {
  const state = {
    partRows: [] as Array<Record<string, any>>,
    orderRows: [] as Array<Record<string, any>>,
    boq: null as Record<string, any> | null,
    createdItems: [] as Array<Record<string, any>>,
  };
  const extractedEntity = {
    findMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      if (where.categoryKey === "FURNITURE_PART_CANDIDATE") return state.partRows;
      if (where.categoryKey === "FURNITURE_ORDER_ITEM_CANDIDATE") return state.orderRows;
      return [];
    }),
  };
  const bOQ = {
    findFirst: vi.fn(async () => state.boq),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  const bOQSection = {
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ id: `section-${data.code}`, ...data })),
    update: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => ({
      id: where.id,
      ...data,
    })),
  };
  const bOQItem = {
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const row = { id: `created-${state.createdItems.length + 1}`, ...data };
      state.createdItems.push(row);
      return row;
    }),
    updateMany: vi.fn(async () => ({ count: 1 })),
    update: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => ({
      id: where.id,
      ...data,
    })),
    deleteMany: vi.fn(async () => ({ count: 1 })),
    findFirstOrThrow: vi.fn(async ({ where }: { where: Record<string, any> }) => ({
      id: where.id,
      companyId: "11111111-1111-4111-8111-111111111111",
      quantity: new Prisma.Decimal(12),
      unitCost: new Prisma.Decimal(0),
      freightCost: new Prisma.Decimal(0),
      installationCost: new Prisma.Decimal(0),
      additionalCost: new Prisma.Decimal(0),
      landedCost: new Prisma.Decimal(0),
      marginMode: "MARKUP",
      marginPercentage: new Prisma.Decimal(0),
      sellingRate: new Prisma.Decimal(0),
    })),
  };
  const bOQItemRateProvenance = {
    findUnique: vi.fn(async () => null),
  };
  const tx = { extractedEntity, bOQ, bOQSection, bOQItem, bOQItemRateProvenance };
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return {
    state,
    tx,
    prisma,
    extractedEntity,
    bOQ,
    bOQSection,
    bOQItem,
    bOQItemRateProvenance,
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: managedStore.prisma }));
vi.mock("@/lib/furniture/canonical-output", () => ({
  buildFurnitureCanonicalOutput: mocks.buildFurnitureCanonicalOutput,
  FURNITURE_CANONICAL_OUTPUT_VERSION: "furniture-canonical-v1",
}));
vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
}));
vi.mock("@/lib/repositories/audit-repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));
vi.mock("@/lib/services/estimate-integrity-service", () => ({
  recordReviewedExtractionQuantity: mocks.recordReviewedExtractionQuantity,
  confirmManualQuantityProvenance: mocks.confirmManualQuantityProvenance,
}));

import {
  furnitureManagedItemCode,
  furnitureManagedNotes,
  furnitureManagedSourceReference,
  regenerateFurnitureManagedBOQ,
} from "@/lib/services/furniture-boq-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const BOQ_ID = "33333333-3333-4333-8333-333333333333";
const FILE_ID = "44444444-4444-4444-8444-444444444444";
const CONFIRMED_AT = new Date("2026-08-31T01:00:00.000Z");

const actor: CurrentActor = {
  userId: "55555555-5555-4555-8555-555555555555",
  companyId: COMPANY_ID,
  role: UserRole.COMPANY_OWNER,
  fullName: "Controlled Furniture Owner",
  email: "controlled-owner@example.test",
};

function reading(valueMm: number) {
  return {
    valueMm,
    readings: [{
      columnKey: "source",
      rawValue: String(valueMm),
      valueMm,
      evidenceReference: "Cutting List!F5",
    }],
    hasConflict: false,
  };
}

function partCandidate(): FurniturePartCandidate {
  return {
    candidateId: "furniture-candidate-v1:Cutting%20List%3A0:5%3A0",
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
      depth: reading(560),
      thickness: reading(18),
    },
    material: { raw: "MDF", name: "MDF", finish: "Oak" },
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
      sourceFileId: FILE_ID,
      sourceFileName: "controlled-cutting-list.xlsx",
      sourceKind: "WORKBOOK",
      method: "TABLE_PARSER",
      sourceTableId: "parts-table",
      sourceRowId: "parts-row",
      sheetName: "Cutting List",
      pageNumber: null,
      rowNumber: 5,
      drawingReference: "ELEV-A",
      confidence: 96,
      sourceCellReferences: ["Cutting List!A5", "Cutting List!F5"],
      rawCells: { part: "Door panel", width_mm: "600" },
    },
    issues: [],
    verificationStatus: "APPROVED_LOCKED",
  };
}

function orderCandidate(): FurnitureOrderItemCandidate {
  return {
    id: "furniture-order-item-v1:Hardware%20%26%20Accessories%20BOQ%3A0:7%3A0",
    description: "Soft-close concealed hinge",
    quantity: 12,
    quantityText: "12",
    unit: "pcs",
    category: "HARDWARE",
    suppliedByOthers: false,
    notes: "Base cabinet doors",
    mappingVersion: "furniture-order-item-v1",
    verificationStatus: "APPROVED_LOCKED",
    issues: [],
    evidence: {
      sheetName: "Hardware & Accessories BOQ",
      rowNumber: 7,
      sourceCellReferences: ["Hardware & Accessories BOQ!A7", "Hardware & Accessories BOQ!B7"],
      sourceTableId: "order-table",
      sourceRowId: "order-row",
      sourceFileId: FILE_ID,
      sourceFileName: "controlled-cutting-list.xlsx",
      sourceKind: "WORKBOOK",
      pageNumber: null,
      confidence: 94,
      method: "TABLE_PARSER",
      sourceTableKey: "Hardware & Accessories BOQ:0",
      sourceRowKey: "7:0",
      rawCells: { description: "Soft-close concealed hinge", quantity: "12" },
    },
  };
}

function partRow(status: ExtractedEntityStatus = ExtractedEntityStatus.CONFIRMED) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    status,
    confirmedAt: status === ExtractedEntityStatus.CONFIRMED ? CONFIRMED_AT : null,
    updatedAt: new Date("2026-08-31T01:05:00.000Z"),
    technicalDataJson: {
      kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      candidate: partCandidate(),
    },
  };
}

function orderRow(status: ExtractedEntityStatus = ExtractedEntityStatus.CONFIRMED) {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    status,
    confirmedAt: status === ExtractedEntityStatus.CONFIRMED ? CONFIRMED_AT : null,
    updatedAt: new Date("2026-08-31T01:06:00.000Z"),
    technicalDataJson: {
      kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
      candidate: orderCandidate(),
    },
  };
}

function canonicalHardwareItem() {
  return {
    managedKey: "hardware:confirmed-order-item",
    sectionCode: "HWA" as const,
    category: "HARDWARE",
    description: "Soft-close concealed hinge",
    specification: "Confirmed HARDWARE order item.",
    quantity: 12,
    unit: "pcs",
    wastagePercentage: 0,
    roomOrZone: "KITCHEN",
    drawingReference: "Hardware & Accessories BOQ",
    confidenceScore: 94,
    notes: "Base cabinet doors",
    evidence: {
      extractedEntityIds: ["77777777-7777-4777-8777-777777777777"],
      candidateIds: [orderCandidate().id],
      sourceFileIds: [FILE_ID],
      sourceFileNames: ["controlled-cutting-list.xlsx"],
      sourceReferences: ["Hardware & Accessories BOQ · row 7"],
      sourceCellReferences: ["Hardware & Accessories BOQ!A7"],
      confirmationTimestamps: [CONFIRMED_AT.toISOString()],
      sourceMethods: ["TABLE_PARSER"],
    },
  };
}

function outputWith(items: Array<ReturnType<typeof canonicalHardwareItem>>) {
  return {
    sections: items.length === 0
      ? []
      : [{
          code: "HWA",
          title: "Hardware, Accessories & Specialist Order Items",
          description: "Confirmed order items.",
          sortOrder: 3,
          items,
        }],
  };
}

function emptyBoq() {
  return {
    id: BOQ_ID,
    projectId: PROJECT_ID,
    status: BOQStatus.DRAFT,
    isLocked: false,
    version: 1,
    sections: [],
  };
}

describe("Furniture managed BOQ hardware/order integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managedStore.state.partRows = [partRow()];
    managedStore.state.orderRows = [orderRow()];
    managedStore.state.boq = emptyBoq();
    managedStore.state.createdItems = [];
    mocks.getProjectRecord.mockResolvedValue({
      id: PROJECT_ID,
      reference: "FJC-CONTROLLED",
      name: "Controlled Furniture Project",
      industryEngine: { key: JOINERY_INDUSTRY_KEY },
    });
    mocks.buildFurnitureCanonicalOutput.mockReturnValue(outputWith([]));
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.recordReviewedExtractionQuantity.mockResolvedValue(undefined);
    mocks.confirmManualQuantityProvenance.mockResolvedValue(undefined);
  });

  it("blocks pending part candidates before reading or mutating a BOQ", async () => {
    managedStore.state.partRows = [partRow(ExtractedEntityStatus.NEEDS_REVIEW)];

    await expect(regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: "controlled-project",
      boqId: BOQ_ID,
      wastagePercentage: 10,
    })).rejects.toMatchObject({ code: "FURNITURE_CANDIDATES_REQUIRE_REVIEW", status: 409 });

    expect(mocks.buildFurnitureCanonicalOutput).not.toHaveBeenCalled();
    expect(managedStore.bOQ.findFirst).not.toHaveBeenCalled();
    expect(managedStore.bOQ.updateMany).not.toHaveBeenCalled();
  });

  it("blocks pending hardware/order items before canonical output or BOQ writes", async () => {
    managedStore.state.orderRows = [orderRow(ExtractedEntityStatus.NEEDS_REVIEW)];

    await expect(regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: "controlled-project",
      boqId: BOQ_ID,
      wastagePercentage: 10,
    })).rejects.toMatchObject({ code: "FURNITURE_ORDER_ITEMS_REQUIRE_REVIEW", status: 409 });

    expect(mocks.buildFurnitureCanonicalOutput).not.toHaveBeenCalled();
    expect(managedStore.bOQ.findFirst).not.toHaveBeenCalled();
    expect(managedStore.bOQ.updateMany).not.toHaveBeenCalled();
  });

  it("passes only confirmed order items to canonical output without flattening their shape", async () => {
    const result = await regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: "controlled-project",
      boqId: BOQ_ID,
      wastagePercentage: 10,
    });

    expect(result.changed).toBe(false);
    const canonicalInput = mocks.buildFurnitureCanonicalOutput.mock.calls[0][0];
    expect(canonicalInput.confirmedCandidates).toEqual([
      expect.objectContaining({
        entityId: "66666666-6666-4666-8666-666666666666",
        status: "CONFIRMED",
        candidate: partCandidate(),
      }),
    ]);
    expect(canonicalInput.confirmedOrderItems).toEqual([
      expect.objectContaining({
        entityId: "77777777-7777-4777-8777-777777777777",
        status: "CONFIRMED",
        item: orderCandidate(),
      }),
    ]);
    expect(canonicalInput.confirmedOrderItems[0].item).not.toHaveProperty("part");
  });

  it("records reviewed extraction quantity provenance for every newly created managed row", async () => {
    const item = canonicalHardwareItem();
    mocks.buildFurnitureCanonicalOutput.mockReturnValue(outputWith([item]));

    const result = await regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: "controlled-project",
      boqId: BOQ_ID,
      wastagePercentage: 10,
    });

    expect(result).toMatchObject({ changed: true, createdItems: 1, updatedItems: 0 });
    expect(managedStore.bOQItem.create).toHaveBeenCalledTimes(1);
    expect(mocks.recordReviewedExtractionQuantity).toHaveBeenCalledWith(
      managedStore.tx,
      {
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
        item: expect.objectContaining({ id: "created-1", description: item.description }),
        extractedEntityId: "77777777-7777-4777-8777-777777777777",
        projectFileId: FILE_ID,
        actor: { userId: actor.userId, name: actor.fullName },
      },
    );
  });

  it("refreshes reviewed extraction quantity provenance on managed updates", async () => {
    const item = canonicalHardwareItem();
    mocks.buildFurnitureCanonicalOutput.mockReturnValue(outputWith([item]));
    const existing = {
      id: "88888888-8888-4888-8888-888888888888",
      companyId: COMPANY_ID,
      sectionId: "section-HWA",
      itemNumber: 10_000,
      itemCode: furnitureManagedItemCode(item.managedKey),
      category: item.category,
      description: "Old hardware description",
      specification: item.specification,
      quantity: new Prisma.Decimal(item.quantity),
      unit: item.unit,
      unitCost: new Prisma.Decimal(0),
      freightCost: new Prisma.Decimal(0),
      installationCost: new Prisma.Decimal(0),
      additionalCost: new Prisma.Decimal(0),
      landedCost: new Prisma.Decimal(0),
      marginMode: "MARKUP",
      marginPercentage: new Prisma.Decimal(0),
      sellingRate: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
      wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
      sourceReference: furnitureManagedSourceReference(item),
      roomOrZone: item.roomOrZone,
      drawingReference: item.drawingReference,
      confidenceScore: new Prisma.Decimal(item.confidenceScore),
      notes: furnitureManagedNotes(item),
      sortOrder: 10_000,
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
    };
    managedStore.state.boq = {
      ...emptyBoq(),
      sections: [{
        id: "section-HWA",
        code: "HWA",
        title: "Hardware, Accessories & Specialist Order Items",
        description: "Confirmed order items.",
        sortOrder: 3,
        items: [existing],
      }],
    };

    const result = await regenerateFurnitureManagedBOQ(actor, {
      projectIdentifier: "controlled-project",
      boqId: BOQ_ID,
      wastagePercentage: 10,
    });

    expect(result).toMatchObject({ changed: true, createdItems: 0, updatedItems: 1 });
    expect(managedStore.bOQItem.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.recordReviewedExtractionQuantity).toHaveBeenCalledWith(
      managedStore.tx,
      {
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
        item: expect.objectContaining({ id: existing.id }),
        extractedEntityId: "77777777-7777-4777-8777-777777777777",
        projectFileId: FILE_ID,
        actor: { userId: actor.userId, name: actor.fullName },
      },
    );
  });
});
