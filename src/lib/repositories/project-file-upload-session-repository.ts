import type { ProjectFileUploadSession, ProjectFileUploadSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export type CreateUploadSessionInput = {
  companyId: string;
  projectId: string;
  actorUserId: string;
  fileId: string;
  storageKey: string;
  originalName: string;
  declaredMimeType: string;
  declaredByteSize: number;
  extension: string;
  expiresAt: Date;
};

export async function createUploadSession(input: CreateUploadSessionInput): Promise<ProjectFileUploadSession> {
  return prisma.projectFileUploadSession.create({ data: input });
}

/** Tenant-scoped lookup — a session belonging to another company never resolves, matching every other repository's isolation pattern. */
export async function getUploadSession(companyId: string, sessionId: string): Promise<ProjectFileUploadSession> {
  const row = await prisma.projectFileUploadSession.findFirst({ where: { id: sessionId, companyId } });
  if (!row) throw new NotFoundError("Upload session not found.");
  return row;
}

export async function setUploadSessionStatus(
  sessionId: string,
  status: ProjectFileUploadSessionStatus,
  finalizedAt?: Date,
): Promise<ProjectFileUploadSession> {
  return prisma.projectFileUploadSession.update({
    where: { id: sessionId },
    data: { status, ...(finalizedAt ? { finalizedAt } : {}) },
  });
}

/** Sessions past expiry that never finalized — safe to report/clean up; never deletes a FINALIZED session's audit trail. */
export async function listOrphanUploadSessions(companyId: string, limit = 100): Promise<ProjectFileUploadSession[]> {
  return prisma.projectFileUploadSession.findMany({
    where: { companyId, status: "PENDING", expiresAt: { lt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}
