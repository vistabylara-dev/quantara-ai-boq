import {
  MarginMode,
  Prisma,
  RateProvenanceSource,
  UserRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
} from "../src/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  findLatestRevision: vi.fn(),
  getBOQItemRecord: vi.fn(),
  updateBOQItem: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bOQ: { findFirst: mocks.findLatestRevision },
  },
}));

vi.mock("@/lib/repositories/boq-repository", () => ({
  getBOQItemRecord: mocks.getBOQItemRecord,
  updateBOQItem: mocks.updateBOQItem,
}));

import { updateRateOnlyBOQItemUnitRate } from "../src/lib/services/rate-only-boq-service";

const actor: CurrentActor = {
  userId: "9cab0791-6d61-4784-a154-b6b2884333cf",
  companyId: "6a34338d-0f5a-4720-a5f5-d04701a36b28",
  role: UserRole.ESTIMATOR,
  fullName: "Rate Estimator",
  email: "rate-estimator@example.com",
};

const currentItem = {
  id: "854dfca3-70cc-4364-8a2e-53b318092e67",
  itemCode: "A-001",
  quantity: new Prisma.Decimal(3),
  unit: "m2",
  unitCost: new Prisma.Decimal(10),
  freightCost: new Prisma.Decimal(2),
  installationCost: new Prisma.Decimal(1),
  additionalCost: new Prisma.Decimal(0.5),
  marginMode: MarginMode.MARKUP,
  marginPercentage: new Prisma.Decimal(10),
  sellingRate: new Prisma.Decimal(14.85),
  sectionId: "a91e62a5-f1eb-4d4c-81ab-37b8da30e2fd",
  section: {
    boqId: "627232df-a8fe-4d84-9615-46498ae5c777",
    boq: {
      id: "627232df-a8fe-4d84-9615-46498ae5c777",
      projectId: "08475416-1c5f-4b15-abff-cd61db5ab247",
      revisionNumber: 1,
    },
  },
};

describe("rate-only BOQ service unit boundary", () => {
  beforeEach(() => {
    mocks.findLatestRevision.mockReset();
    mocks.getBOQItemRecord.mockReset();
    mocks.updateBOQItem.mockReset();
    mocks.getBOQItemRecord.mockResolvedValue(currentItem);
    mocks.findLatestRevision.mockResolvedValue({ id: currentItem.section.boqId, revisionNumber: 1 });
    mocks.updateBOQItem.mockResolvedValue({ id: currentItem.section.boqId });
  });

  it("passes only normalized commercial inputs to the guarded repository and records user provenance", async () => {
    await updateRateOnlyBOQItemUnitRate(actor, currentItem.id, { unitRate: "15.25" });

    expect(mocks.getBOQItemRecord).toHaveBeenCalledWith(actor.companyId, currentItem.id);
    expect(mocks.findLatestRevision).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: actor.companyId, projectId: currentItem.section.boq.projectId },
    }));
    expect(mocks.updateBOQItem).toHaveBeenCalledOnce();
    const [, , patch, context] = mocks.updateBOQItem.mock.calls[0];
    expect(patch).toEqual({
      unitCost: new Prisma.Decimal("15.25"),
      freightCost: 0,
      installationCost: 0,
      additionalCost: 0,
      marginMode: MarginMode.MARKUP,
      marginPercentage: 0,
    });
    expect(patch).not.toHaveProperty("quantity");
    expect(patch).not.toHaveProperty("description");
    expect(patch).not.toHaveProperty("unit");
    expect(context).toEqual(expect.objectContaining({
      integrityActor: { userId: actor.userId, name: actor.fullName },
      rateProvenance: { sourceType: RateProvenanceSource.MANUAL_CONFIRMED },
      additionalAudit: expect.objectContaining({ action: "UNIT_RATE_CONFIRMED" }),
    }));
  });

  it("still supplies explicit manual provenance when the confirmed rate is zero", async () => {
    await updateRateOnlyBOQItemUnitRate(actor, currentItem.id, { unitRate: 0 });

    const [, , patch, context] = mocks.updateBOQItem.mock.calls[0];
    expect(patch.unitCost.toString()).toBe("0");
    expect(context.rateProvenance.sourceType).toBe(RateProvenanceSource.MANUAL_CONFIRMED);
    expect(context.additionalAudit.payload.unitRate).toBe("0");
  });

  it("rejects historical revisions before mutation", async () => {
    mocks.findLatestRevision.mockResolvedValue({
      id: "fb358ada-ab1f-46ac-a39d-83f51adf249c",
      revisionNumber: 2,
    });

    await expect(
      updateRateOnlyBOQItemUnitRate(actor, currentItem.id, { unitRate: "20" }),
    ).rejects.toEqual(expect.objectContaining<Partial<ConflictError>>({ code: "BOQ_REVISION_HISTORICAL" }));
    expect(mocks.updateBOQItem).not.toHaveBeenCalled();
  });

  it("checks RBAC before data access and keeps tenant lookup scoped to the actor company", async () => {
    const designer = { ...actor, role: UserRole.DESIGNER };
    await expect(
      updateRateOnlyBOQItemUnitRate(designer, currentItem.id, { unitRate: "20" }),
    ).rejects.toThrow(PermissionDeniedError);
    expect(mocks.getBOQItemRecord).not.toHaveBeenCalled();

    mocks.getBOQItemRecord.mockRejectedValueOnce(new NotFoundError("BOQ item not found."));
    await expect(
      updateRateOnlyBOQItemUnitRate({ ...actor, companyId: "94c26df4-0af0-42e3-8b1b-4fc13e7301ad" }, currentItem.id, { unitRate: "20" }),
    ).rejects.toThrow(NotFoundError);
  });
});
