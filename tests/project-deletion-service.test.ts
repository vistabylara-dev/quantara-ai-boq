import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanType, ProjectStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  getProjectRecord: vi.fn(),
  archiveProject: vi.fn(),
  getEffectiveEntitlements: vi.fn(),
  boqItemCount: vi.fn(),
  progressedBoqCount: vi.fn(),
  projectCount: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({ requireCapability: mocks.requireCapability }));
vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
  archiveProject: mocks.archiveProject,
}));
vi.mock("@/lib/entitlements/effective-entitlement-service", () => ({
  getEffectiveEntitlements: mocks.getEffectiveEntitlements,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bOQItem: { count: mocks.boqItemCount },
    bOQ: { count: mocks.progressedBoqCount },
    project: { count: mocks.projectCount },
  },
}));

import { deleteUnusedProject } from "@/lib/services/project-deletion-service";

const actor = {
  userId: "user-a",
  companyId: "company-a",
  role: "COMPANY_OWNER",
} as never;

describe("deleteUnusedProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectRecord.mockResolvedValue({
      id: "project-a",
      status: ProjectStatus.DRAFT,
    });
    mocks.boqItemCount.mockResolvedValue(0);
    mocks.progressedBoqCount.mockResolvedValue(0);
    mocks.projectCount.mockResolvedValue(0);
    mocks.getEffectiveEntitlements.mockResolvedValue({
      maxProjects: 1,
      isTrial: true,
      planType: PlanType.TRIAL,
    });
    mocks.archiveProject.mockResolvedValue({ id: "project-a" });
  });

  it("archives one empty draft and preserves the tenant boundary", async () => {
    await expect(deleteUnusedProject(actor, "project-a")).resolves.toEqual({ id: "project-a" });

    expect(mocks.requireCapability).toHaveBeenCalledWith(actor, "projects:archive");
    expect(mocks.getProjectRecord).toHaveBeenCalledWith("company-a", "project-a");
    expect(mocks.archiveProject).toHaveBeenCalledWith("company-a", "project-a");
  });

  it("refuses deletion after BOQ items exist", async () => {
    mocks.boqItemCount.mockResolvedValue(1);

    await expect(deleteUnusedProject(actor, "project-a")).rejects.toMatchObject({
      code: "PROJECT_BOQ_ALREADY_GENERATED",
      status: 409,
    });
    expect(mocks.archiveProject).not.toHaveBeenCalled();
  });

  it("prevents trial users from recycling the free replacement", async () => {
    mocks.projectCount.mockResolvedValue(1);

    await expect(deleteUnusedProject(actor, "project-a")).rejects.toMatchObject({
      code: "EMPTY_PROJECT_REPLACEMENT_LIMIT_REACHED",
      status: 409,
    });
    expect(mocks.archiveProject).not.toHaveBeenCalled();
  });
});
