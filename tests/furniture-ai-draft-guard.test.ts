import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
} from "@/lib/furniture/types";

const mocks = vi.hoisted(() => ({
  findLatestBoq: vi.fn(),
  findEntities: vi.fn(),
  getProjectRecord: vi.fn(),
  getBOQRecord: vi.fn(),
  createProjectBOQ: vi.fn(),
}));

const managedFurnitureRow = {
  id: "33333333-3333-4333-8333-333333333333",
  companyId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  projectFileId: "44444444-4444-4444-8444-444444444444",
  categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  entityType: "FURNITURE",
  label: "Door panel",
  quantity: { toNumber: () => 2 },
  unit: "pcs",
  confidence: { toNumber: () => 96 },
  sourceText: "Preserved cutting-list evidence",
  technicalDataJson: { kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND },
  status: "CONFIRMED",
  createdAt: new Date("2026-08-31T00:00:00.000Z"),
};

const tx = {
  extractedEntity: {
    findMany: mocks.findEntities,
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bOQ: { findFirst: mocks.findLatestBoq },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  },
}));
vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
}));
vi.mock("@/lib/repositories/boq-repository", () => ({
  getBOQRecord: mocks.getBOQRecord,
  createProjectBOQ: mocks.createProjectBOQ,
}));
vi.mock("@/lib/repositories/audit-repository", () => ({ createAuditLog: vi.fn() }));

import { generateAiDraftBoq } from "@/lib/services/ai-draft-boq-service";

const actor = {
  userId: "55555555-5555-4555-8555-555555555555",
  companyId: managedFurnitureRow.companyId,
  role: UserRole.COMPANY_OWNER,
  fullName: "Controlled Owner",
  email: "controlled-owner@example.test",
};

describe("Generic AI Draft furniture isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectRecord.mockResolvedValue({ id: managedFurnitureRow.projectId });
    mocks.findLatestBoq.mockResolvedValue({ id: "boq-1" });
    mocks.getBOQRecord.mockResolvedValue({
      id: "boq-1",
      projectId: managedFurnitureRow.projectId,
      status: "DRAFT",
      isLocked: false,
      version: 1,
      sections: [],
    });
    mocks.findEntities.mockImplementation(async ({ where }: { where: Record<string, any> }) => {
      const furnitureExcluded = Array.isArray(where.OR)
        && where.OR.some((branch: Record<string, any>) =>
          Array.isArray(branch.categoryKey?.notIn)
          && branch.categoryKey.notIn.includes(FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND)
          && branch.categoryKey.notIn.includes(FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND));
      return furnitureExcluded ? [] : [managedFurnitureRow];
    });
  });

  it("excludes managed furniture candidates at the database query boundary", async () => {
    const result = await generateAiDraftBoq(actor, "controlled-project");

    expect(result).toMatchObject({ boqId: "boq-1", addedCount: 0 });
    expect(mocks.findEntities).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        companyId: managedFurnitureRow.companyId,
        projectId: managedFurnitureRow.projectId,
        OR: [
          { categoryKey: null },
          {
            categoryKey: {
              notIn: [
                FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
                FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
              ],
            },
          },
        ],
      }),
    }));
  });
});
