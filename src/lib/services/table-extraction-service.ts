import { ExtractionEngineType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { listExtractedTablesForFile as listExtractedTablesForFileRepo, toExtractedTableDTO } from "@/lib/repositories/extracted-table-repository";
import { toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { TABLE_EXTRACTABLE_EXTENSIONS } from "@/lib/files/table-extraction/constants";
import { getSourceProcessingCapability } from "@/lib/files/source-processing-capability";

/** Dispatches the appropriate extraction engine(s) for a file's type. Only TABLE_EXTRACTION exists so far; later sub-phases extend this switch as new engines land. */
export async function triggerFileExtraction(actor: CurrentActor, fileId: string) {
  requireCapability(actor, "files:manage");

  // Register the complete handler composition before dispatch. The queue is a singleton,
  // so processing remains safe even when enqueue/worker code is evaluated in another module context.
  await import("@/lib/jobs/register-handlers");

  const file = await getProjectFileRecord(actor.companyId, fileId);

  const capability = getSourceProcessingCapability(file.extension);
  if (!capability.canExtractTables) {
    throw new AppError(
      "EXTRACTION_NOT_SUPPORTED",
      `${capability.message} Structured extraction is currently enabled for: ${TABLE_EXTRACTABLE_EXTENSIONS.join(", ")}.`,
      400,
    );
  }

  const job = await extractionJobQueue.enqueue({
    companyId: actor.companyId,
    projectId: file.projectId,
    projectFileId: file.id,
    engineType: ExtractionEngineType.TABLE_EXTRACTION,
    createdByUserId: actor.userId,
  });

  await createAuditLog(actor.companyId, {
    entityType: "ProjectFile",
    entityId: fileId,
    action: "FILE_EXTRACTION_TRIGGERED",
    payload: { jobId: job.id, engineType: ExtractionEngineType.TABLE_EXTRACTION },
  });

  return toExtractionJobDTO(job);
}

export async function listExtractedTablesForFile(actor: CurrentActor, fileId: string) {
  await getProjectFileRecord(actor.companyId, fileId);
  const rows = await listExtractedTablesForFileRepo(actor.companyId, fileId);
  return rows.map(toExtractedTableDTO);
}
