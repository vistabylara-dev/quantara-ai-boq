import { expect, test, describe, beforeEach, vi } from "vitest";
import { lockBOQ } from "@/lib/repositories/boq-repository";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError } from "@/lib/errors/app-error";
import { BOQStatus, Prisma } from "@prisma/client";

// Mocks
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: any) => cb(prisma)),
    bOQ: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    bOQRevisionSnapshot: {
      create: vi.fn(),
    },
    bOQItem: {
      updateMany: vi.fn(),
    },
    extractionJob: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn(),
    }
  }
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  canCreateBoq: vi.fn().mockResolvedValue({ allowed: true }),
  recordBoqCompleted: vi.fn(),
}));

vi.mock("@/lib/repositories/audit-repository", () => ({
  createAuditLog: vi.fn(),
}));

describe("lockBOQ Validation", () => {
  const companyId = "company-1";
  const boqId = "boq-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects locking if BOQ contains zero items", async () => {
    // Arrange
    const mockBoq = {
      id: boqId,
      companyId,
      projectId: "proj-1",
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      verifiedAt: new Date(),
      isLocked: false,
      status: BOQStatus.NEEDS_VERIFICATION,
      taxRate: { toNumber: () => 0 },
      discountPercentage: { toNumber: () => 0 },
      verificationExceptions: [],
      sections: [
        { items: [] } // Zero items
      ],
      totals: { grandTotal: 0 }
    };
    
    // Using vi.mocked for typing, though here we just mock the implementations
    const mockedPrisma = prisma as any;
    mockedPrisma.bOQ.findFirst.mockResolvedValue(mockBoq);
    
    // Act & Assert
    await expect(lockBOQ(companyId, boqId)).rejects.toThrowError(
      new AppError("BOQ_REVISION_EMPTY", "This revision contains no BOQ items. Add at least one item before locking.", 400)
    );
  });

  test("rejects locking if item description is missing", async () => {
    const mockBoq = {
      id: boqId,
      companyId,
      projectId: "proj-1",
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      verifiedAt: new Date(),
      isLocked: false,
      status: BOQStatus.NEEDS_VERIFICATION,
      taxRate: { toNumber: () => 0 },
      discountPercentage: { toNumber: () => 0 },
      verificationExceptions: [],
      sections: [
        { 
          items: [{
            id: "item-1",
            itemCode: "IT-01",
            description: "   ", // Missing/empty description
            unit: "m2",
            quantity: { toNumber: () => 10 },
            unitCost: { toNumber: () => 50 },
            totalAmount: { toNumber: () => 500 }
          }] 
        }
      ],
      totals: { grandTotal: 500 }
    };
    
    const mockedPrisma = prisma as any;
    mockedPrisma.bOQ.findFirst.mockResolvedValue(mockBoq);
    
    await expect(lockBOQ(companyId, boqId)).rejects.toThrowError(
      new AppError("BOQ_ITEM_INVALID_DESCRIPTION", "IT-01 is missing a description.", 400)
    );
  });

  test("rejects locking if quantity is zero", async () => {
    const mockBoq = {
      id: boqId,
      companyId,
      projectId: "proj-1",
      project: { slug: "proj-1-slug" },
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      verifiedAt: new Date(),
      isLocked: false,
      status: BOQStatus.NEEDS_VERIFICATION,
      taxRate: { toNumber: () => 0 },
      discountPercentage: { toNumber: () => 0 },
      verificationExceptions: [],
      sections: [
        { 
          items: [{
            id: "item-1",
            itemCode: "IT-01",
            description: "Valid item",
            unit: "m2",
            quantity: { toNumber: () => 0 }, // Invalid quantity
            unitCost: { toNumber: () => 50 },
            totalAmount: { toNumber: () => 0 }
          }] 
        }
      ],
      totals: { grandTotal: 0 }
    };
    
    const mockedPrisma = prisma as any;
    mockedPrisma.bOQ.findFirst.mockResolvedValue(mockBoq);
    
    await expect(lockBOQ(companyId, boqId)).rejects.toThrowError(
      new AppError("BOQ_ITEM_INVALID_QUANTITY", "IT-01 has a quantity less than or equal to zero.", 400)
    );
  });
  
  test("returns DTO if already locked (idempotent)", async () => {
    const mockBoq = {
      id: boqId,
      companyId,
      projectId: "proj-1",
      project: { slug: "proj-1-slug" },
      revisionNumber: 1,
      version: 2,
      verifiedVersion: 2,
      verifiedAt: new Date(),
      isLocked: true, // Already locked
      status: BOQStatus.LOCKED,
      sections: [],
      totals: { grandTotal: 0 },
      taxRate: new Prisma.Decimal(0),
      discountPercentage: new Prisma.Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const mockedPrisma = prisma as any;
    mockedPrisma.bOQ.findFirst.mockResolvedValue(mockBoq);
    
    const result = await lockBOQ(companyId, boqId);
    expect(result.id).toBe(boqId);
    expect(result.status).toBe("locked");
  });
});
