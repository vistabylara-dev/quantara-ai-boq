import type { ExtractionJob } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export function toExtractionJobDTO(row: ExtractionJob) {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    projectFileId: row.projectFileId,
    engineType: row.engineType,
    provider: row.provider,
    status: row.status,
    progressPercentage: row.progressPercentage,
    currentStep: row.currentStep,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    attempts: row.attempts,
    maximumAttempts: row.maximumAttempts,
    resultSummary: row.resultSummaryJson,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getExtractionJobRecord(companyId: string, jobId: string): Promise<ExtractionJob> {
  const row = await prisma.extractionJob.findFirst({ where: { id: jobId, companyId } });
  if (!row) throw new NotFoundError("Extraction job not found.");
  return row;
}

export async function listExtractionJobsForFile(companyId: string, projectFileId: string): Promise<ExtractionJob[]> {
  return prisma.extractionJob.findMany({
    where: { companyId, projectFileId },
    orderBy: { createdAt: "desc" },
  });
}
