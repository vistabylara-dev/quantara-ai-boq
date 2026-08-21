import { prisma } from "@/lib/db/prisma";
import type { Prisma, TablePageResolution, TablePageResolutionDecision } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function getTablePageResolution(
  companyId: string,
  projectFileId: string,
  pageNumber: number,
): Promise<TablePageResolution | null> {
  return prisma.tablePageResolution.findFirst({
    where: { companyId, projectFileId, pageNumber },
  });
}

/**
 * One row per (projectFileId, pageNumber) — created lazily on the first
 * decision, never pre-created for every page. Keeps actor/timestamp/decision
 * separate from parser evidence (ExtractedTable/ExtractedEntity rows for
 * this page, if any, are never touched here).
 */
export async function recordTablePageResolutionDecision(
  input: {
    companyId: string;
    projectId: string;
    projectFileId: string;
    pageNumber: number;
    extractionJobId?: string | null;
    decision: TablePageResolutionDecision;
    decidedByUserId: string;
  },
  db: DbClient = prisma,
): Promise<TablePageResolution> {
  return db.tablePageResolution.upsert({
    where: { projectFileId_pageNumber: { projectFileId: input.projectFileId, pageNumber: input.pageNumber } },
    update: {
      decision: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: new Date(),
      extractionJobId: input.extractionJobId ?? undefined,
    },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      projectFileId: input.projectFileId,
      pageNumber: input.pageNumber,
      extractionJobId: input.extractionJobId ?? null,
      decision: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: new Date(),
    },
  });
}
