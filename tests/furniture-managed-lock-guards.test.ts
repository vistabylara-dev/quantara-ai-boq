import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFurnitureCanonicalOutput,
  computeFurnitureInputSignature,
  FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX,
  type ConfirmedFurnitureCandidate,
} from "@/lib/furniture/canonical-output";
import {
  FURNITURE_CANDIDATE_MAPPING_VERSION,
  type FurniturePartCandidate,
} from "@/lib/furniture/candidate-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_JOINERY_INDUSTRY_KEY,
  furnitureManagedItemCodeForKey,
  FURNITURE_MANAGED_SOURCE_PREFIX,
  isStrictFurnitureManagedNonCommercialRow,
} from "@/lib/furniture/types";
import {
  furnitureManagedItemCode,
  readFurnitureManagedKey,
} from "@/lib/services/furniture-boq-service";
import { lockBOQ } from "@/lib/repositories/boq-repository";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const transactionClient = {
    bOQ: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    extractedEntity: {
      findMany: vi.fn(),
    },
    bOQRevisionSnapshot: {
      create: vi.fn(),
    },
    bOQItem: {
      updateMany: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    prisma: {
      ...transactionClient,
      $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)),
    },
  };
});

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  canCreateBoq: vi.fn().mockResolvedValue({ allowed: true }),
  recordBoqCompleted: vi.fn(),
}));

vi.mock("@/lib/repositories/audit-repository", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/furniture/project-discipline", () => ({
  getFurnitureProjectDiscipline: vi.fn().mockResolvedValue("JOINERY_CABINETRY"),
}));

function partCandidate(id = "candidate-1"): FurniturePartCandidate {
  const dimension = (columnKey: string, valueMm: number) => ({
    valueMm,
    readings: [{ columnKey, rawValue: String(valueMm), valueMm, evidenceReference: `Cutting List!${columnKey}` }],
    hasConflict: false,
  });
  return {
    candidateId: id,
    mappingVersion: FURNITURE_CANDIDATE_MAPPING_VERSION,
    discipline: "JOINERY_CABINETRY",
    room: "KITCHEN",
    elevationReference: "E01",
    assembly: "Base cabinet",
    assemblyGroupKey: "kitchen|e01|base-cabinet",
    part: "Door Panel",
    quantity: 2,
    dimensions: {
      width: dimension("B5", 600),
      height: dimension("C5", 800),
      depth: dimension("D5", 18),
      thickness: dimension("E5", 18),
    },
    material: { raw: "MDF (Oak)", name: "MDF", finish: "Oak" },
    edgeBanding: {
      raw: "All four edges",
      mode: "ALL_FOUR",
      selectedEdges: [{ dimension: "WIDTH", count: 2 }, { dimension: "HEIGHT", count: 2 }],
      orientation: "EXPLICIT",
    },
    grainDirection: "Vertical",
    hardwareNotes: [],
    notes: "Reviewed source.",
    evidence: {
      sourceFileId: "source-file-1",
      sourceFileName: "schedule.xlsx",
      sourceKind: "WORKBOOK",
      method: "furniture-workbook-v1",
      sheetName: "Cutting List",
      pageNumber: null,
      rowNumber: 5,
      drawingReference: "E01",
      confidence: 98,
      sourceCellReferences: ["Cutting List!A5"],
      rawCells: { room: "KITCHEN", part: "Door Panel" },
    },
    issues: [],
    verificationStatus: "READY_FOR_REVIEW",
  };
}

function confirmedCandidate(): ConfirmedFurnitureCandidate {
  return {
    entityId: "entity-part-1",
    status: "CONFIRMED",
    confirmedAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:01:00.000Z",
    candidate: partCandidate(),
  };
}

function managedMarker(key: string): string {
  return `${FURNITURE_MANAGED_SOURCE_PREFIX}${encodeURIComponent(key)}]`;
}

describe("furniture managed input signatures", () => {
  const partOne = {
    entityId: "part-1",
    status: "CONFIRMED" as const,
    confirmedAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:01:00.000Z",
  };
  const partTwo = {
    entityId: "part-2",
    status: "CONFIRMED" as const,
    confirmedAt: "2026-08-31T08:02:00.000Z",
    updatedAt: "2026-08-31T08:03:00.000Z",
  };
  const orderOne = {
    entityId: "order-1",
    status: "CONFIRMED" as const,
    confirmedAt: "2026-08-31T08:04:00.000Z",
    updatedAt: "2026-08-31T08:05:00.000Z",
  };

  const signature = (
    partEntities: readonly typeof partOne[],
    orderEntities: readonly typeof orderOne[] = [orderOne],
  ) => computeFurnitureInputSignature({
    discipline: "JOINERY_CABINETRY",
    wastagePercentage: 10,
    partEntities,
    orderEntities,
  });

  it("is stable for the same confirmed part/order set independent of query order", () => {
    const forward = signature([partOne, partTwo]);
    const reverse = computeFurnitureInputSignature({
      discipline: "JOINERY_CABINETRY",
      wastagePercentage: 10,
      partEntities: [partTwo, partOne],
      orderEntities: [orderOne],
    });
    expect(forward).toMatch(/^[0-9a-f]{64}$/);
    expect(reverse).toBe(forward);
  });

  it("changes when a candidate is added or its confirmation state is updated", () => {
    const original = signature([partOne]);
    expect(signature([partOne, partTwo])).not.toBe(original);
    expect(signature([{ ...partOne, updatedAt: "2026-08-31T09:00:00.000Z" }])).not.toBe(original);
  });

  it("represents a zero-percent wastage assumption as a nonzero structural record", () => {
    const output = buildFurnitureCanonicalOutput({
      projectId: "project-1",
      projectReference: "FJC-001",
      projectName: "Controlled Furniture Test",
      discipline: "JOINERY_CABINETRY",
      wastagePercentage: 0,
      confirmedCandidates: [confirmedCandidate()],
    });
    const assumption = output.sections
      .flatMap(({ items }) => items)
      .find(({ managedKey }) => managedKey === "assumption:wastage");
    expect(assumption).toMatchObject({ quantity: 1, unit: "record", wastagePercentage: 0 });
    expect(assumption?.specification).toContain("0%");
  });
});

describe("strict furniture managed identity", () => {
  const managedKey = "order:SUPPLIED_BY_OTHERS:client-appliance";
  const marker = managedMarker(managedKey);
  const valid = {
    itemCode: furnitureManagedItemCode(managedKey),
    sourceReference: `${marker} schedule.xlsx`,
    notes: `${marker}\nConfirmed source evidence`,
  };

  it("requires matching source/notes markers and the deterministic item-code hash", () => {
    expect(readFurnitureManagedKey(valid)).toBe(managedKey);
    expect(readFurnitureManagedKey({ ...valid, notes: "Confirmed source evidence" })).toBeNull();
    expect(readFurnitureManagedKey({ ...valid, notes: `${managedMarker("different-key")}\nEvidence` })).toBeNull();
    expect(readFurnitureManagedKey({ ...valid, itemCode: furnitureManagedItemCode("different-key") })).toBeNull();
  });

  it("accepts only the exact noncommercial supplied-by-others HWA import guard", () => {
    const identity = {
      industryKey: FURNITURE_JOINERY_INDUSTRY_KEY,
      sectionCode: "HWA",
      sourceType: "IMPORT",
      category: "SUPPLIED_BY_OTHERS",
      ...valid,
    };
    expect(isStrictFurnitureManagedNonCommercialRow(identity)).toBe(true);
    expect(isStrictFurnitureManagedNonCommercialRow({ ...identity, sectionCode: "BRD" })).toBe(false);
    expect(isStrictFurnitureManagedNonCommercialRow({ ...identity, sourceType: "MANUAL" })).toBe(false);
    expect(isStrictFurnitureManagedNonCommercialRow({ ...identity, notes: "single marker removed" })).toBe(false);
  });
});

describe("managed furniture lock freshness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a stale input signature before any lock write occurs", async () => {
    const signatureKey = "integrity:input-signature";
    const marker = managedMarker(signatureKey);
    const current = {
      id: "boq-1",
      companyId: "company-1",
      projectId: "project-1",
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      verifiedAt: new Date("2026-08-31T08:10:00.000Z"),
      isLocked: false,
      taxRate: new Prisma.Decimal(0),
      discountPercentage: new Prisma.Decimal(0),
      verificationExceptions: [],
      project: {
        industryEngine: { key: FURNITURE_JOINERY_INDUSTRY_KEY },
      },
      sections: [{
        code: "VER",
        items: [{
          id: "item-signature-1",
          itemNumber: 1,
          itemCode: furnitureManagedItemCodeForKey(signatureKey),
          description: "Managed furniture input signature",
          sourceReference: marker,
          notes: marker,
          category: "VERIFICATION_ITEM",
          sourceType: "IMPORT",
          specification: `${FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX}${"0".repeat(64)}`,
          quantity: new Prisma.Decimal(1),
          unit: "item",
          unitCost: new Prisma.Decimal(0),
          freightCost: new Prisma.Decimal(0),
          installationCost: new Prisma.Decimal(0),
          additionalCost: new Prisma.Decimal(0),
          marginMode: "MARKUP",
          marginPercentage: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
          wastagePercentage: new Prisma.Decimal(10),
          quantityProvenance: {
            sourceType: "IMPORT_CONFIRMED",
            confirmedAt: new Date("2026-08-31T08:05:00.000Z"),
            quantitySnapshot: new Prisma.Decimal(1),
            unitSnapshot: "item",
          },
          rateProvenance: {
            sourceType: "IMPORT_CONFIRMED",
            confirmedAt: new Date("2026-08-31T08:05:00.000Z"),
            unitCostSnapshot: new Prisma.Decimal(0),
            freightCostSnapshot: new Prisma.Decimal(0),
            installationCostSnapshot: new Prisma.Decimal(0),
            additionalCostSnapshot: new Prisma.Decimal(0),
            marginModeSnapshot: "MARKUP",
            marginPercentageSnapshot: new Prisma.Decimal(0),
          },
        }],
      }],
    };
    vi.mocked(prisma.bOQ.findFirst).mockResolvedValue(current as never);
    vi.mocked(prisma.extractedEntity.findMany).mockResolvedValue([{
      id: "entity-part-1",
      categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
      status: "CONFIRMED",
      confirmedAt: new Date("2026-08-31T08:00:00.000Z"),
      updatedAt: new Date("2026-08-31T08:01:00.000Z"),
    }] as never);

    await expect(lockBOQ("company-1", "boq-1")).rejects.toMatchObject({
      code: "FURNITURE_REGENERATION_REQUIRED",
    });
    expect(prisma.bOQ.updateMany).not.toHaveBeenCalled();
    expect(prisma.bOQRevisionSnapshot.create).not.toHaveBeenCalled();
    expect(prisma.bOQItem.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
