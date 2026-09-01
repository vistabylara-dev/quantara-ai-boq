import { MarginMode, Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import type { FurnitureCanonicalItem } from "@/lib/furniture/canonical-output";
import {
  confirmManualRateProvenance,
  confirmManualQuantityProvenance,
  recordReviewedExtractionQuantity,
} from "@/lib/services/estimate-integrity-service";
import {
  furnitureManagedItemCode,
  furnitureManagedNotes,
  furnitureManagedSourceReference,
  planFurnitureManagedRows,
  recordFurnitureManagedQuantityProvenance,
  type ExistingFurnitureManagedBOQItem,
} from "@/lib/services/furniture-boq-service";

vi.mock("@/lib/services/estimate-integrity-service", () => ({
  confirmManualRateProvenance: vi.fn(),
  confirmManualQuantityProvenance: vi.fn(),
  recordReviewedExtractionQuantity: vi.fn(),
}));

const actor: CurrentActor = {
  userId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  role: UserRole.COMPANY_OWNER,
  fullName: "Controlled Test Owner",
  email: "controlled-owner@example.invalid",
};

function canonicalItem(overrides: Partial<FurnitureCanonicalItem> = {}): FurnitureCanonicalItem {
  return {
    managedKey: "board:test",
    sectionCode: "BRD",
    category: "BOARD",
    description: "Test board",
    specification: "18 mm MDF",
    quantity: 2,
    unit: "sheets",
    wastagePercentage: 10,
    roomOrZone: "Kitchen",
    drawingReference: "E01",
    confidenceScore: 98,
    notes: "Reviewed source",
    evidence: {
      extractedEntityIds: ["33333333-3333-4333-8333-333333333333"],
      candidateIds: ["candidate-1"],
      sourceFileIds: ["44444444-4444-4444-8444-444444444444"],
      sourceFileNames: ["schedule.xlsx"],
      sourceReferences: ["Cutting List!A5"],
      sourceCellReferences: ["Cutting List!A5"],
      confirmationTimestamps: ["2026-08-31T08:00:00.000Z"],
      sourceMethods: ["furniture-workbook-v1"],
    },
    ...overrides,
  };
}

function existing(
  id: string,
  item: FurnitureCanonicalItem,
  overrides: Partial<ExistingFurnitureManagedBOQItem> = {},
): ExistingFurnitureManagedBOQItem {
  return {
    id,
    sectionId: "section-brd",
    sectionCode: item.sectionCode,
    sourceType: "IMPORT",
    itemCode: furnitureManagedItemCode(item.managedKey),
    sourceReference: furnitureManagedSourceReference(item),
    category: item.category,
    description: item.description,
    specification: item.specification,
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    confidenceScore: new Prisma.Decimal(item.confidenceScore),
    notes: furnitureManagedNotes(item),
    itemNumber: 10_000,
    sortOrder: 10_000,
    sellingRate: new Prisma.Decimal(0),
    unitCost: new Prisma.Decimal(0),
    freightCost: new Prisma.Decimal(0),
    installationCost: new Prisma.Decimal(0),
    additionalCost: new Prisma.Decimal(0),
    landedCost: new Prisma.Decimal(0),
    marginMode: MarginMode.MARKUP,
    marginPercentage: new Prisma.Decimal(0),
    createdAt: new Date("2026-08-31T08:00:00.000Z"),
    ...overrides,
  };
}

function persistedItem() {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    quantity: new Prisma.Decimal(2),
    unit: "sheets",
    unitCost: new Prisma.Decimal(0),
    freightCost: new Prisma.Decimal(0),
    installationCost: new Prisma.Decimal(0),
    additionalCost: new Prisma.Decimal(0),
    marginMode: MarginMode.MARKUP,
    marginPercentage: new Prisma.Decimal(0),
  };
}

describe("managed furniture BOQ hardening", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the complete managed marker in a <=500 character source reference and retains full sources in notes", () => {
    const fullSources = ["A".repeat(700), "Second source", "Third source"];
    const item = canonicalItem({
      evidence: { ...canonicalItem().evidence, sourceReferences: fullSources },
    });
    const sourceReference = furnitureManagedSourceReference(item);
    expect(sourceReference.length).toBeLessThanOrEqual(500);
    expect(sourceReference).toContain("[FJC_MANAGED_V1:board%3Atest]");
    expect(sourceReference).toContain("(+2 more)");
    expect(furnitureManagedNotes(item)).toContain(`Source references: ${fullSources.join(" | ")}`);
  });

  it("keeps a priced duplicate even when it is newer", () => {
    const desired = canonicalItem();
    const unpriced = existing("unpriced-old", desired);
    const priced = existing("priced-new", desired, {
      sellingRate: new Prisma.Decimal(125),
      unitCost: new Prisma.Decimal(100),
      landedCost: new Prisma.Decimal(100),
      createdAt: new Date("2026-08-31T08:01:00.000Z"),
    });
    const plan = planFurnitureManagedRows([unpriced, priced], [desired]);
    expect(plan.deleteIds).toEqual(["unpriced-old"]);
    expect(plan.unchangedIds).toEqual(["priced-new"]);
  });

  it("fails closed rather than deleting duplicates with different nonzero commercial pricing", () => {
    const desired = canonicalItem();
    const first = existing("priced-a", desired, {
      sellingRate: new Prisma.Decimal(125),
      unitCost: new Prisma.Decimal(100),
    });
    const second = existing("priced-b", desired, {
      sellingRate: new Prisma.Decimal(130),
      unitCost: new Prisma.Decimal(105),
      createdAt: new Date("2026-08-31T08:01:00.000Z"),
    });
    expect(() => planFurnitureManagedRows([first, second], [desired])).toThrowError(
      expect.objectContaining({ code: "FURNITURE_MANAGED_PRICING_CONFLICT" }),
    );
  });

  it("records reviewed-extraction quantity provenance without creating rate provenance", async () => {
    const item = canonicalItem();
    const persisted = persistedItem();
    await recordFurnitureManagedQuantityProvenance(
      {} as Prisma.TransactionClient,
      actor.companyId,
      "66666666-6666-4666-8666-666666666666",
      persisted as never,
      item,
      actor,
    );
    expect(recordReviewedExtractionQuantity).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        extractedEntityId: item.evidence.extractedEntityIds[0],
        projectFileId: item.evidence.sourceFileIds[0],
        item: persisted,
      }),
    );
    expect(confirmManualQuantityProvenance).not.toHaveBeenCalled();
    expect(confirmManualRateProvenance).not.toHaveBeenCalled();
  });

  it("records explicit zero-rate provenance for strict managed non-commercial rows", async () => {
    const item = canonicalItem({
      managedKey: "project:summary",
      sectionCode: "PRJ",
      category: "PROJECT_SUMMARY",
      unit: "confirmed parts",
    });
    const persisted = {
      ...persistedItem(),
      itemCode: furnitureManagedItemCode(item.managedKey),
      sourceReference: furnitureManagedSourceReference(item),
      notes: furnitureManagedNotes(item),
    };
    await recordFurnitureManagedQuantityProvenance(
      {} as Prisma.TransactionClient,
      actor.companyId,
      "66666666-6666-4666-8666-666666666666",
      persisted as never,
      item,
      actor,
    );
    expect(confirmManualRateProvenance).toHaveBeenCalledWith(
      {},
      actor.companyId,
      "66666666-6666-4666-8666-666666666666",
      persisted,
      { userId: actor.userId, name: actor.fullName },
    );
  });

  it("uses manual quantity provenance only for the caller-owned wastage assumption", async () => {
    const assumption = canonicalItem({
      managedKey: "assumption:wastage",
      sectionCode: "VER",
      category: "ASSUMPTION",
      evidence: {
        extractedEntityIds: [],
        candidateIds: [],
        sourceFileIds: [],
        sourceFileNames: [],
        sourceReferences: [],
        sourceCellReferences: [],
        confirmationTimestamps: [],
        sourceMethods: [],
      },
    });
    await recordFurnitureManagedQuantityProvenance(
      {} as Prisma.TransactionClient,
      actor.companyId,
      "66666666-6666-4666-8666-666666666666",
      persistedItem() as never,
      assumption,
      actor,
    );
    expect(confirmManualQuantityProvenance).toHaveBeenCalledOnce();
    expect(recordReviewedExtractionQuantity).not.toHaveBeenCalled();

    await expect(recordFurnitureManagedQuantityProvenance(
      {} as Prisma.TransactionClient,
      actor.companyId,
      "66666666-6666-4666-8666-666666666666",
      persistedItem() as never,
      canonicalItem({ evidence: assumption.evidence }),
      actor,
    )).rejects.toMatchObject({ code: "FURNITURE_QUANTITY_EVIDENCE_REQUIRED" });
  });
});
