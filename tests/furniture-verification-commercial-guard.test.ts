import { BOQStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  furnitureManagedItemCodeForKey,
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FURNITURE_MANAGED_SOURCE_PREFIX,
} from "@/lib/furniture/types";

const verificationMocks = vi.hoisted(() => ({
  getBOQRecord: vi.fn(),
  toBOQDTO: vi.fn((value: unknown) => value),
  createAuditLog: vi.fn(),
  evaluateBOQFinalizationGate: vi.fn(() => ({
    lockEligible: false,
    freshlyVerified: true,
    lockReason: "TEST",
    unconfirmedItemCount: 0,
  })),
}));

const verificationStore = vi.hoisted(() => {
  const state = { createdDrafts: [] as Array<Record<string, any>> };
  const bOQ = { updateMany: vi.fn(async () => ({ count: 1 })) };
  const verificationException = {
    findMany: vi.fn(async () => []),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, any>> }) => {
      state.createdDrafts.push(...data);
      return { count: data.length };
    }),
  };
  const tx = { bOQ, verificationException };
  const prisma = {
    rateCatalogueItem: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { state, bOQ, verificationException, tx, prisma };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: verificationStore.prisma }));
vi.mock("@/lib/repositories/boq-repository", () => ({
  getBOQRecord: verificationMocks.getBOQRecord,
  toBOQDTO: verificationMocks.toBOQDTO,
}));
vi.mock("@/lib/repositories/audit-repository", () => ({
  createAuditLog: verificationMocks.createAuditLog,
}));
vi.mock("@/lib/boq/finalization-gate", () => ({
  evaluateBOQFinalizationGate: verificationMocks.evaluateBOQFinalizationGate,
}));

import { runBOQVerification } from "@/lib/repositories/verification-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const BOQ_ID = "33333333-3333-4333-8333-333333333333";

function item(input: {
  id: string;
  category: string;
  sourceReference: string;
  itemCode?: string;
  notes?: string;
  sourceType?: string;
}) {
  return {
    id: input.id,
    itemCode: input.itemCode ?? `MANUAL-${input.id}`,
    description: `Verification row ${input.id}`,
    specification: "Controlled specification",
    quantity: 1,
    unit: "item",
    unitCost: 0,
    freightCost: 0,
    installationCost: 0,
    additionalCost: 0,
    landedCost: 0,
    sellingRate: 0,
    marginPercentage: 0,
    confidenceScore: 100,
    drawingReference: "FJC-CONTROLLED",
    pricingMetadataJson: null,
    status: "NEEDS_REVIEW",
    category: input.category,
    sourceReference: input.sourceReference,
    notes: input.notes ?? "Manual row",
    sourceType: input.sourceType ?? "IMPORT",
    updatedAt: new Date("2026-08-31T01:00:00.000Z"),
  };
}

function managedIdentity(managedKey: string) {
  const marker = `${FURNITURE_MANAGED_SOURCE_PREFIX}${encodeURIComponent(managedKey)}]`;
  return {
    itemCode: furnitureManagedItemCodeForKey(managedKey),
    sourceReference: `${marker} controlled source`,
    notes: `${marker}\nControlled managed evidence`,
    sourceType: "IMPORT",
  };
}

function boq(industryKey: string, items: Array<ReturnType<typeof item>>) {
  return {
    id: BOQ_ID,
    companyId: COMPANY_ID,
    projectId: PROJECT_ID,
    status: BOQStatus.DRAFT,
    isLocked: false,
    version: 1,
    verifiedVersion: null,
    verifiedAt: null,
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
    project: {
      industryEngineId: "44444444-4444-4444-8444-444444444444",
      industryEngine: { key: industryKey, configJson: {} },
    },
    sections: [{ id: "section-1", code: "PRJ", items }],
    verificationExceptions: [],
  };
}

function zeroSellingRateItemIds(): string[] {
  return verificationStore.state.createdDrafts
    .filter((draft) => draft.type === "ZERO_SELLING_RATE")
    .map((draft) => draft.boqItemId)
    .sort();
}

describe("Furniture non-commercial verification guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificationStore.state.createdDrafts = [];
    verificationMocks.createAuditLog.mockResolvedValue(undefined);
  });

  it("waives zero-selling-rate only for exact-industry, managed-marker, non-commercial rows", async () => {
    const managedSummary = item({
      id: "managed-summary",
      category: "PROJECT_SUMMARY",
      ...managedIdentity("summary:project"),
    });
    const managedCommercialFurniture = item({
      id: "managed-commercial",
      category: "MATERIAL",
      ...managedIdentity("material:board"),
    });
    const unmarkedNonCommercialCategory = item({
      id: "unmarked-summary",
      category: "PROJECT_SUMMARY",
      sourceReference: "Manual project summary row",
    });
    verificationMocks.getBOQRecord.mockResolvedValue(boq(FURNITURE_JOINERY_INDUSTRY_KEY, [
      managedSummary,
      managedCommercialFurniture,
      unmarkedNonCommercialCategory,
    ]));

    await runBOQVerification(COMPANY_ID, BOQ_ID, new Date("2026-08-31T02:00:00.000Z"));

    expect(zeroSellingRateItemIds()).toEqual(["managed-commercial", "unmarked-summary"]);
  });

  it("keeps zero-selling-rate enforcement for every non-furniture industry even with a managed-looking marker", async () => {
    const nonFurnitureRow = item({
      id: "non-furniture-summary",
      category: "PROJECT_SUMMARY",
      ...managedIdentity("summary:project"),
    });
    verificationMocks.getBOQRecord.mockResolvedValue(boq("interior-design", [nonFurnitureRow]));

    await runBOQVerification(COMPANY_ID, BOQ_ID, new Date("2026-08-31T02:00:00.000Z"));

    expect(zeroSellingRateItemIds()).toEqual(["non-furniture-summary"]);
  });
});
