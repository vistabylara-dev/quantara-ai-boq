import type { Prisma, ProjectFileUploadSession } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getUploadSessionForUpdate } from "../src/lib/repositories/project-file-upload-session-repository";

describe("getUploadSessionForUpdate", () => {
  it("serializes through the tenant-scoped Prisma update path", async () => {
    const lockedSession = {
      id: "00000000-0000-0000-0000-000000000001",
      companyId: "00000000-0000-0000-0000-000000000002",
      projectId: "00000000-0000-0000-0000-000000000003",
      actorUserId: "00000000-0000-0000-0000-000000000004",
      fileId: "00000000-0000-0000-0000-000000000005",
      status: "PENDING",
    } as ProjectFileUploadSession;
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue(lockedSession);
    const queryRaw = vi.fn();
    const db = { $queryRaw: queryRaw, projectFileUploadSession: { updateMany, findFirst } } as unknown as Prisma.TransactionClient;

    await expect(getUploadSessionForUpdate(lockedSession.companyId, lockedSession.id, db)).resolves.toBe(lockedSession);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: lockedSession.id, companyId: lockedSession.companyId },
      data: { updatedAt: expect.any(Date) },
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
