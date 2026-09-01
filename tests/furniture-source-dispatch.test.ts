import { beforeEach, describe, expect, it, vi } from "vitest";
import { JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";

const mocks = vi.hoisted(() => ({
  getProjectRecord: vi.fn(),
  getProjectFileRecord: vi.fn(),
  listProjectFiles: vi.fn(),
  listExtractedTablesForFile: vi.fn(),
  hasReviewedTableDerivedCandidates: vi.fn(),
  generateFurnitureCandidatesFromStructuredTables: vi.fn(),
}));

vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
}));
vi.mock("@/lib/repositories/project-file-repository", () => ({
  getProjectFileRecord: mocks.getProjectFileRecord,
  listProjectFiles: mocks.listProjectFiles,
}));
vi.mock("@/lib/repositories/extracted-table-repository", () => ({
  listExtractedTablesForFile: mocks.listExtractedTablesForFile,
}));
vi.mock("@/lib/repositories/extracted-entity-repository", () => ({
  hasReviewedTableDerivedCandidates: mocks.hasReviewedTableDerivedCandidates,
}));
vi.mock("@/lib/services/furniture-candidate-service", () => ({
  generateFurnitureCandidatesFromStructuredTables: mocks.generateFurnitureCandidatesFromStructuredTables,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { extractedEntity: { deleteMany: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/repositories/audit-repository", () => ({ createAuditLog: vi.fn() }));

import { generateCandidatesFromStructuredTables } from "@/lib/services/source-candidate-bridge-service";

const input = {
  companyId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  projectFileId: "33333333-3333-4333-8333-333333333333",
  extractionJobId: "44444444-4444-4444-8444-444444444444",
};

describe("Exact Joinery source dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectFileRecord.mockResolvedValue({ id: input.projectFileId, projectId: input.projectId });
    mocks.hasReviewedTableDerivedCandidates.mockResolvedValue(false);
    mocks.listExtractedTablesForFile.mockResolvedValue([]);
  });

  it("dispatches established Joinery to the guarded cutting-list mapper", async () => {
    const mapped = {
      status: "generated",
      tablesConsidered: 2,
      rowsConsidered: 155,
      candidatesCreated: 155,
    };
    mocks.getProjectRecord.mockResolvedValue({
      id: input.projectId,
      industryEngine: { key: JOINERY_INDUSTRY_KEY },
    });
    mocks.generateFurnitureCandidatesFromStructuredTables.mockResolvedValue(mapped);

    const result = await generateCandidatesFromStructuredTables(input);

    expect(result).toBe(mapped);
    expect(mocks.generateFurnitureCandidatesFromStructuredTables).toHaveBeenCalledOnce();
    expect(mocks.generateFurnitureCandidatesFromStructuredTables).toHaveBeenCalledWith(input);
    expect(mocks.getProjectFileRecord).not.toHaveBeenCalled();
    expect(mocks.listExtractedTablesForFile).not.toHaveBeenCalled();
  });

  it.each(["construction", "furniture", "interior-fitout"])(
    "keeps the existing %s industry on the generic bridge",
    async (industryKey) => {
      mocks.getProjectRecord.mockResolvedValue({
        id: input.projectId,
        industryEngine: { key: industryKey },
      });

      const result = await generateCandidatesFromStructuredTables(input);

      expect(result).toEqual({
        status: "generated",
        tablesConsidered: 0,
        rowsConsidered: 0,
        candidatesCreated: 0,
      });
      expect(mocks.generateFurnitureCandidatesFromStructuredTables).not.toHaveBeenCalled();
      expect(mocks.getProjectFileRecord).toHaveBeenCalledWith(input.companyId, input.projectFileId);
      expect(mocks.listExtractedTablesForFile).toHaveBeenCalledWith(input.companyId, input.projectFileId);
    },
  );

  it("preserves the generic bridge's existing reviewed-row protection", async () => {
    mocks.getProjectRecord.mockResolvedValue({
      id: input.projectId,
      industryEngine: { key: "construction" },
    });
    mocks.hasReviewedTableDerivedCandidates.mockResolvedValue(true);

    const result = await generateCandidatesFromStructuredTables(input);

    expect(result).toMatchObject({ status: "skipped", candidatesCreated: 0 });
    expect(mocks.generateFurnitureCandidatesFromStructuredTables).not.toHaveBeenCalled();
    expect(mocks.listExtractedTablesForFile).not.toHaveBeenCalled();
  });
});
