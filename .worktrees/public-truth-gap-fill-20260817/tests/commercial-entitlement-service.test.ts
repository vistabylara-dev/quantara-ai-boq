import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  generateBoqCommercialManifest, 
  assertCleanOutputAuthorized,
  BoqCommercialManifest 
} from "@/lib/services/commercial-entitlement-service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { randomUUID } from "crypto";

// Mock prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bOQRevisionSnapshot: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    bOQ: {
      findUnique: vi.fn()
    },
    masterItem: {
      findMany: vi.fn()
    },
    companyPackageSubscription: {
      findMany: vi.fn()
    }
  }
}));

describe("Commercial Entitlement Service", () => {
  const companyId = randomUUID();
  const projectId = randomUUID();
  const boqId = randomUUID();
  const revisionNumber = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Manifest Fingerprinting", () => {
    it("should generate a deterministic fingerprint for identical manifest inputs", async () => {
      // Create a mock snapshot with some premium items
      const mockSnapshot = {
        id: randomUUID(),
        boqId,
        projectId,
        companyId,
        revisionNumber,
        snapshotJson: {
          sections: [
            {
              items: [
                { sourceMasterItemId: "item-1" },
                { sourceMasterItemId: "item-2" }
              ]
            }
          ]
        }
      };

      vi.mocked(prisma.bOQRevisionSnapshot.findFirst).mockResolvedValue(mockSnapshot as any);
      vi.mocked(prisma.masterItem.findMany).mockResolvedValue([
        { id: "item-1", isPremium: true, packageItems: [{ packageId: "pkg-1", package: { id: "pkg-1", key: "pkg-1", name: "Pkg 1" } }] },
        { id: "item-2", isPremium: true, packageItems: [{ packageId: "pkg-2", package: { id: "pkg-2", key: "pkg-2", name: "Pkg 2" } }] }
      ] as any);
      
      // Mock ledger to say nothing is satisfied yet
      vi.mocked(prisma.companyPackageSubscription.findMany).mockResolvedValue([]);

      const manifest1 = await generateBoqCommercialManifest(companyId, projectId, boqId, revisionNumber, "BOQ", "PDF");
      const manifest2 = await generateBoqCommercialManifest(companyId, projectId, boqId, revisionNumber, "BOQ", "PDF");

      expect(manifest1.manifestFingerprint).toBeDefined();
      expect(manifest1.manifestFingerprint).toEqual(manifest2.manifestFingerprint);
    });

    it("should generate a different fingerprint when output type changes", async () => {
      const mockSnapshot = {
        id: randomUUID(),
        boqId,
        projectId,
        companyId,
        revisionNumber,
        snapshotJson: {
          sections: [{ items: [{ sourceMasterItemId: "item-1" }] }]
        }
      };

      vi.mocked(prisma.bOQRevisionSnapshot.findFirst).mockResolvedValue(mockSnapshot as any);
      vi.mocked(prisma.masterItem.findMany).mockResolvedValue([
        { id: "item-1", isPremium: true, packageItems: [{ packageId: "pkg-1", package: { id: "pkg-1", key: "pkg-1", name: "Pkg 1" } }] }
      ] as any);
      vi.mocked(prisma.companyPackageSubscription.findMany).mockResolvedValue([]);

      const manifest1 = await generateBoqCommercialManifest(companyId, projectId, boqId, revisionNumber, "BOQ", "PDF");
      const manifest2 = await generateBoqCommercialManifest(companyId, projectId, boqId, revisionNumber, "BOQ", "XLSX");

      expect(manifest1.manifestFingerprint).not.toEqual(manifest2.manifestFingerprint);
    });
  });

  describe("Block-on-Unauthorized-Download Scenarios", () => {
    it("should block download if commercial requirements are not met", async () => {
      // Mock manifest generation to return unmet requirements
      vi.mocked(prisma.bOQRevisionSnapshot.findFirst).mockResolvedValue({
        id: randomUUID(),
        boqId,
        projectId,
        companyId,
        revisionNumber,
        snapshotJson: {
          sections: [{ items: [{ sourceMasterItemId: "item-1" }] }]
        }
      } as any);

      vi.mocked(prisma.masterItem.findMany).mockResolvedValue([
        { id: "item-1", isPremium: true, packageItems: [{ packageId: "pkg-1", package: { id: "pkg-1", key: "pkg-1", name: "Pkg 1" } }] }
      ] as any);
      vi.mocked(prisma.companyPackageSubscription.findMany).mockResolvedValue([]); // Unmet

      await expect(assertCleanOutputAuthorized(companyId, projectId, boqId, revisionNumber, "PDF"))
        .rejects
        .toThrow(AppError);
        
      await expect(assertCleanOutputAuthorized(companyId, projectId, boqId, revisionNumber, "PDF"))
        .rejects
        .toMatchObject({ code: "COMMERCIAL_UNLOCK_REQUIRED" });
    });

    it("should allow download if all commercial requirements are met", async () => {
      vi.mocked(prisma.bOQRevisionSnapshot.findFirst).mockResolvedValue({
        id: randomUUID(),
        boqId,
        projectId,
        companyId,
        revisionNumber,
        snapshotJson: {
          sections: [{ items: [{ sourceMasterItemId: "item-1" }] }]
        }
      } as any);

      vi.mocked(prisma.masterItem.findMany).mockResolvedValue([
        { id: "item-1", isPremium: true, packageItems: [{ packageId: "pkg-1", package: { id: "pkg-1", key: "pkg-1", name: "Pkg 1" } }] }
      ] as any);
      
      // Mock ledger indicating package is purchased
      vi.mocked(prisma.companyPackageSubscription.findMany).mockResolvedValue([
        { packageId: "pkg-1" }
      ] as any);

      // Should not throw
      await expect(assertCleanOutputAuthorized(companyId, projectId, boqId, revisionNumber, "PDF")).resolves.toBeUndefined();
    });
  });
  
  describe("Multi-line Fulfillment", () => {
     it("should consider requirements fulfilled if all lines are in the ledger", async () => {
      vi.mocked(prisma.bOQRevisionSnapshot.findFirst).mockResolvedValue({
        id: randomUUID(),
        boqId,
        projectId,
        companyId,
        revisionNumber,
        snapshotJson: {
          sections: [{ items: [{ sourceMasterItemId: "item-1" }, { sourceMasterItemId: "item-2" }] }]
        }
      } as any);

      vi.mocked(prisma.masterItem.findMany).mockResolvedValue([
        { id: "item-1", isPremium: true, packageItems: [{ packageId: "pkg-1", package: { id: "pkg-1", key: "pkg-1", name: "Pkg 1" } }] },
        { id: "item-2", isPremium: true, packageItems: [{ packageId: "pkg-2", package: { id: "pkg-2", key: "pkg-2", name: "Pkg 2" } }] }
      ] as any);
      
      // Mock ledger indicating BOTH packages are purchased (multi-line fulfillment)
      vi.mocked(prisma.companyPackageSubscription.findMany).mockResolvedValue([
        { packageId: "pkg-1" },
        { packageId: "pkg-2" }
      ] as any);

      const manifest = await generateBoqCommercialManifest(companyId, projectId, boqId, revisionNumber, "BOQ", "PDF");
      expect(manifest.allCommercialRequirementsSatisfied).toBe(true);
      expect(manifest.packageRequirements.every(r => r.isSatisfied)).toBe(true);
     });
  });
});
