import { Prisma, type ProjectFileUploadSession, type ProjectFileUploadSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

type DbClient = typeof prisma | Prisma.TransactionClient;

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

export async function createUploadSession(
  input: CreateUploadSessionInput,
  db: DbClient = prisma,
): Promise<ProjectFileUploadSession> {
  return db.projectFileUploadSession.create({ data: input });
}

/** Tenant-scoped lookup — a session belonging to another company never resolves, matching every other repository's isolation pattern. */
export async function getUploadSession(
  companyId: string,
  sessionId: string,
  db: DbClient = prisma,
): Promise<ProjectFileUploadSession> {
  const row = await db.projectFileUploadSession.findFirst({ where: { id: sessionId, companyId } });
  if (!row) throw new NotFoundError("Upload session not found.");
  return row;
}

/**
 * Serializes finalization and retry recovery for one tenant-scoped upload
 * session. The row lock is held until the caller's transaction commits.
 */
export async function getUploadSessionForUpdate(
  companyId: string,
  sessionId: string,
  db: Prisma.TransactionClient,
): Promise<ProjectFileUploadSession> {
  const locked = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "ProjectFileUploadSession"
    WHERE "id" = ${sessionId}::uuid AND "companyId" = ${companyId}::uuid
    FOR UPDATE
  `);
  if (locked.length === 0) throw new NotFoundError("Upload session not found.");
  return getUploadSession(companyId, sessionId, db);
}

export async function setUploadSessionStatus(
  sessionId: string,
  status: ProjectFileUploadSessionStatus,
  finalizedAt?: Date,
  db: DbClient = prisma,
): Promise<ProjectFileUploadSession> {
  return db.projectFileUploadSession.update({
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
