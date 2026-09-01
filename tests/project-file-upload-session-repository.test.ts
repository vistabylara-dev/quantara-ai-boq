import type { Prisma, ProjectFileUploadSession } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getUploadSessionForUpdate } from "../src/lib/repositories/project-file-upload-session-repository";

describe("getUploadSessionForUpdate", () => {
  it("returns the row from the locking query without starting a second query", async () => {
    const lockedSession = {
      id: "00000000-0000-0000-0000-000000000001",
      companyId: "00000000-0000-0000-0000-000000000002",
      projectId: "00000000-0000-0000-0000-000000000003",
      actorUserId: "00000000-0000-0000-0000-000000000004",
      fileId: "00000000-0000-0000-0000-000000000005",
      status: "PENDING",
    } as ProjectFileUploadSession;
    const queryRaw = vi.fn().mockResolvedValue([lockedSession]);
    const findFirst = vi.fn();
    const db = { $queryRaw: queryRaw, projectFileUploadSession: { findFirst } } as unknown as Prisma.TransactionClient;

    await expect(getUploadSessionForUpdate(lockedSession.companyId, lockedSession.id, db)).resolves.toBe(lockedSession);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
