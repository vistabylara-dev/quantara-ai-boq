import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { getExtractionJobRecord, listExtractionJobsForFile as listExtractionJobsForFileRepo, toExtractionJobDTO } from "@/lib/repositories/extraction-job-repository";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export async function listExtractionJobsForFile(actor: CurrentActor, fileId: string) {
  await getProjectFileRecord(actor.companyId, fileId);
  const rows = await listExtractionJobsForFileRepo(actor.companyId, fileId);
  return rows.map(toExtractionJobDTO);
}

export async function getExtractionJob(actor: CurrentActor, jobId: string) {
  const row = await getExtractionJobRecord(actor.companyId, jobId);
  return toExtractionJobDTO(row);
}

export async function cancelExtractionJob(actor: CurrentActor, jobId: string) {
  requireCapability(actor, "files:manage");
  const updated = await extractionJobQueue.cancel(actor.companyId, jobId);
  return toExtractionJobDTO(updated);
}
