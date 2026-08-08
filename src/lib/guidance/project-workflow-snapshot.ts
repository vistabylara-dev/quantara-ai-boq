import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { getProjectRecord } from "@/lib/repositories/project-repository";

export type ProvenCount = number | null;

export type ProjectSourceSnapshot = {
  id: string;
  name: string;
  origin: "Google Drive" | "Uploaded manually";
  status: string;
  currentJobStatus: string | null;
  hasProcessingError: boolean;
  needsReview: boolean;
  isProcessing: boolean;
  hasCapturedResults: boolean;
  pageCount: ProvenCount;
  tableCount: ProvenCount;
  classification: string | null;
  revisionNumber: string | null;
};

export type ProjectWorkflowSnapshot = {
  projectId: string;
  projectSlug: string;
  files: {
    total: number;
    manualOriginCount: ProvenCount;
    googleDriveOriginCount: ProvenCount;
    statusCounts: Record<string, number> | null;
    processingErrorCount: ProvenCount;
    needsReviewCount: ProvenCount;
    classifiedCount: ProvenCount;
    revisionedCount: ProvenCount;
  };
  processingJobs: {
    total: ProvenCount;
    queued: ProvenCount;
    running: ProvenCount;
    completed: ProvenCount;
    failed: ProvenCount;
    needsReview: ProvenCount;
    cancelled: ProvenCount;
    storedResultCount: ProvenCount;
  };
  capturedResults: {
    pageCount: ProvenCount;
    tableCount: ProvenCount;
    storedJobResultCount: ProvenCount;
    artifactCount: ProvenCount;
  };
  extractedEntities: {
    total: ProvenCount;
    needsReview: ProvenCount;
    confirmed: ProvenCount;
    corrected: ProvenCount;
    rejected: ProvenCount;
    imported: ProvenCount;
    unknown: ProvenCount;
  };
  boq: {
    exists: boolean | null;
  };
  sources: ProjectSourceSnapshot[];
};

export type ProjectWorkflowSnapshotFileRecord = {
  id: string;
  originalName: string;
  metadata: unknown;
  status: string | null | undefined;
  pageCount: number | null;
  classification: string | null | undefined;
  revisionNumber: string | null;
  processingErrorCode: string | null;
  processingErrorMessage: string | null;
  drawingPageCount?: number | null;
  extractedTableCount?: number | null;
};

export type ProjectWorkflowSnapshotJobRecord = {
  id: string;
  projectFileId: string;
  engineType?: string | null;
  status: string | null | undefined;
  createdAt: Date | string;
  resultSummary?: unknown;
};

export type ProjectWorkflowSnapshotRecords = {
  projectId: string;
  projectSlug: string;
  files: readonly ProjectWorkflowSnapshotFileRecord[];
  jobs?: readonly ProjectWorkflowSnapshotJobRecord[] | null;
  entityStatuses?: readonly (string | null | undefined)[] | null;
  hasBoq?: boolean | null;
};

const RUNNING_FILE_STATUSES = new Set(["CLASSIFYING", "PREPROCESSING", "PROCESSING"]);
const RUNNING_JOB_STATUSES = new Set(["QUEUED", "RUNNING"]);
const REVIEW_JOB_STATUSES = new Set(["NEEDS_INPUT", "NEEDS_REVIEW"]);
const KNOWN_FILE_STATUSES = new Set([
  "UPLOADED",
  "CLASSIFYING",
  "CLASSIFIED",
  "PREPROCESSING",
  "READY_FOR_PROCESSING",
  "PROCESSING",
  "NEEDS_REVIEW",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
]);
const KNOWN_JOB_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "NEEDS_INPUT",
  "NEEDS_REVIEW",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
const REVIEWED_ENTITY_STATUSES = new Set(["CONFIRMED", "CORRECTED", "REJECTED", "IMPORTED"]);
const REVIEWABLE_ENTITY_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW"]);
const SOURCE_JOB_STATUS_PRIORITY = [
  "FAILED",
  "NEEDS_INPUT",
  "NEEDS_REVIEW",
  "CANCELLED",
  "RUNNING",
  "QUEUED",
  "COMPLETED",
] as const;

function normalizeStatus(status: string | null | undefined): string {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoogleDriveSource(metadata: unknown): boolean {
  return isRecord(metadata)
    && isRecord(metadata.importSource)
    && metadata.importSource.provider === "google-drive";
}

function countByStatus(statuses: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const status of statuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function sumKnown(values: readonly (number | null | undefined)[]): number | null {
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    return null;
  }
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function toTimestamp(value: Date | string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function nullableStatusCount(statusCounts: Record<string, number> | null, ...statuses: string[]): number | null {
  if (statusCounts === null) return null;
  return statuses.reduce((total, status) => total + (statusCounts[status] ?? 0), 0);
}

export function buildProjectWorkflowSnapshot(
  records: ProjectWorkflowSnapshotRecords,
): ProjectWorkflowSnapshot {
  const orderedJobs = records.jobs === null || records.jobs === undefined
    ? null
    : [...records.jobs].sort((left, right) => (
      toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
      || right.id.localeCompare(left.id)
    ));
  const currentJobByFileAndEngine = new Map<string, ProjectWorkflowSnapshotJobRecord>();
  const currentJobsByFile = new Map<string, ProjectWorkflowSnapshotJobRecord[]>();
  const allJobsByFile = new Map<string, ProjectWorkflowSnapshotJobRecord[]>();

  if (orderedJobs) {
    for (const job of orderedJobs) {
      const engineType = normalizeStatus(job.engineType) || "UNSPECIFIED";
      const key = `${job.projectFileId}:${engineType}`;
      if (!currentJobByFileAndEngine.has(key)) currentJobByFileAndEngine.set(key, job);
      const fileJobs = allJobsByFile.get(job.projectFileId) ?? [];
      fileJobs.push(job);
      allJobsByFile.set(job.projectFileId, fileJobs);
    }

    for (const job of currentJobByFileAndEngine.values()) {
      const fileJobs = currentJobsByFile.get(job.projectFileId) ?? [];
      fileJobs.push(job);
      currentJobsByFile.set(job.projectFileId, fileJobs);
    }
  }

  const sources = records.files.map<ProjectSourceSnapshot>((file) => {
    const fileStatus = normalizeStatus(file.status);
    const currentJobs = currentJobsByFile.get(file.id) ?? [];
    const currentJobStatuses = currentJobs.map((job) => normalizeStatus(job.status));
    const attentionJobStatus = SOURCE_JOB_STATUS_PRIORITY
      .slice(0, 4)
      .find((status) => currentJobStatuses.includes(status));
    const unknownJobStatus = currentJobStatuses.find((status) => !KNOWN_JOB_STATUSES.has(status));
    const currentJobStatus = attentionJobStatus
      ?? unknownJobStatus
      ?? SOURCE_JOB_STATUS_PRIORITY.slice(4).find((status) => currentJobStatuses.includes(status))
      ?? currentJobStatuses[0]
      ?? null;
    const hasCurrentJobEvidence = currentJobs.length > 0;
    const hasProcessingError = currentJobStatuses.includes("FAILED")
      || (!hasCurrentJobEvidence && Boolean(
        file.processingErrorCode
        || file.processingErrorMessage
        || fileStatus === "FAILED",
      ));
    const needsReview = currentJobStatuses.some((status) => (
      REVIEW_JOB_STATUSES.has(status)
      || status === "CANCELLED"
      || !KNOWN_JOB_STATUSES.has(status)
    )) || (!hasCurrentJobEvidence && (
      fileStatus === "NEEDS_REVIEW"
      || fileStatus === "CANCELLED"
      || !KNOWN_FILE_STATUSES.has(fileStatus)
    ));
    const isProcessing = currentJobStatuses.some((status) => RUNNING_JOB_STATUSES.has(status))
      || (!hasCurrentJobEvidence && RUNNING_FILE_STATUSES.has(fileStatus));
    const storedPageCount = typeof file.drawingPageCount === "number" ? file.drawingPageCount : null;
    const pageCount = storedPageCount !== null && storedPageCount > 0
      ? storedPageCount
      : file.pageCount;
    const tableCount = typeof file.extractedTableCount === "number" ? file.extractedTableCount : null;

    return {
      id: file.id,
      name: file.originalName,
      origin: isGoogleDriveSource(file.metadata) ? "Google Drive" : "Uploaded manually",
      status: fileStatus || "UNKNOWN",
      currentJobStatus,
      hasProcessingError,
      needsReview,
      isProcessing,
      hasCapturedResults: (pageCount ?? 0) > 0
        || (tableCount ?? 0) > 0
        || (allJobsByFile.get(file.id) ?? []).some((job) => job.resultSummary != null),
      pageCount,
      tableCount,
      classification: file.classification ? normalizeStatus(file.classification) : null,
      revisionNumber: file.revisionNumber,
    };
  });

  const sourceStatuses = sources.map((source) => source.status);
  const currentJobStatuses = orderedJobs === null
    ? null
    : Array.from(currentJobByFileAndEngine.values(), (job) => normalizeStatus(job.status));
  const currentJobStatusCounts = currentJobStatuses === null ? null : countByStatus(currentJobStatuses);
  const storedResultCount = orderedJobs === null
    ? null
    : orderedJobs.filter((job) => job.resultSummary != null).length;
  const pageCount = sumKnown(sources.map((source) => source.pageCount));
  const tableCount = sumKnown(sources.map((source) => source.tableCount));

  const entityStatuses = records.entityStatuses === null || records.entityStatuses === undefined
    ? null
    : records.entityStatuses.map(normalizeStatus);
  const entityStatusCounts = entityStatuses === null ? null : countByStatus(entityStatuses);
  const reviewedEntityCount = entityStatuses === null
    ? null
    : entityStatuses.filter((status) => REVIEWED_ENTITY_STATUSES.has(status)).length;
  const reviewableEntityCount = entityStatuses === null
    ? null
    : entityStatuses.filter((status) => REVIEWABLE_ENTITY_STATUSES.has(status)).length;
  const unknownEntityCount = entityStatuses === null
    ? null
    : entityStatuses.length - (reviewedEntityCount ?? 0) - (reviewableEntityCount ?? 0);

  return {
    projectId: records.projectId,
    projectSlug: records.projectSlug,
    files: {
      total: sources.length,
      manualOriginCount: sources.filter((source) => source.origin === "Uploaded manually").length,
      googleDriveOriginCount: sources.filter((source) => source.origin === "Google Drive").length,
      statusCounts: countByStatus(sourceStatuses),
      processingErrorCount: sources.filter((source) => source.hasProcessingError).length,
      needsReviewCount: sources.filter((source) => source.needsReview).length,
      classifiedCount: sources.filter((source) => source.classification && source.classification !== "UNKNOWN").length,
      revisionedCount: sources.filter((source) => Boolean(source.revisionNumber)).length,
    },
    processingJobs: {
      total: currentJobStatuses?.length ?? null,
      queued: nullableStatusCount(currentJobStatusCounts, "QUEUED"),
      running: nullableStatusCount(currentJobStatusCounts, "RUNNING"),
      completed: nullableStatusCount(currentJobStatusCounts, "COMPLETED"),
      failed: nullableStatusCount(currentJobStatusCounts, "FAILED"),
      needsReview: nullableStatusCount(currentJobStatusCounts, "NEEDS_INPUT", "NEEDS_REVIEW"),
      cancelled: nullableStatusCount(currentJobStatusCounts, "CANCELLED"),
      storedResultCount,
    },
    capturedResults: {
      pageCount,
      tableCount,
      storedJobResultCount: storedResultCount,
      artifactCount: null,
    },
    extractedEntities: {
      total: entityStatuses?.length ?? null,
      needsReview: entityStatuses === null
        ? null
        : (reviewableEntityCount ?? 0) + (unknownEntityCount ?? 0),
      confirmed: nullableStatusCount(entityStatusCounts, "CONFIRMED"),
      corrected: nullableStatusCount(entityStatusCounts, "CORRECTED"),
      rejected: nullableStatusCount(entityStatusCounts, "REJECTED"),
      imported: nullableStatusCount(entityStatusCounts, "IMPORTED"),
      unknown: unknownEntityCount,
    },
    boq: { exists: records.hasBoq ?? null },
    sources,
  };
}

export async function getProjectWorkflowSnapshot(
  actor: CurrentActor,
  projectIdentifier: string,
): Promise<ProjectWorkflowSnapshot> {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  const [files, jobs, entities, boq] = await Promise.all([
    prisma.projectFile.findMany({
      where: { companyId: actor.companyId, projectId: project.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        originalName: true,
        metadataJson: true,
        status: true,
        pageCount: true,
        classification: true,
        revisionNumber: true,
        processingErrorCode: true,
        processingErrorMessage: true,
        _count: { select: { drawingPages: true, extractedTables: true } },
      },
    }),
    prisma.extractionJob.findMany({
      where: { companyId: actor.companyId, projectId: project.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        projectFileId: true,
        engineType: true,
        status: true,
        createdAt: true,
        resultSummaryJson: true,
      },
    }),
    prisma.extractedEntity.findMany({
      where: { companyId: actor.companyId, projectId: project.id },
      select: { status: true },
    }),
    prisma.bOQ.findFirst({
      where: { companyId: actor.companyId, projectId: project.id },
      select: { id: true },
    }),
  ]);

  return buildProjectWorkflowSnapshot({
    projectId: project.id,
    projectSlug: project.slug,
    files: files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      metadata: file.metadataJson,
      status: file.status,
      pageCount: file.pageCount,
      classification: file.classification,
      revisionNumber: file.revisionNumber,
      processingErrorCode: file.processingErrorCode,
      processingErrorMessage: file.processingErrorMessage,
      drawingPageCount: file._count.drawingPages,
      extractedTableCount: file._count.extractedTables,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      projectFileId: job.projectFileId,
      engineType: job.engineType,
      status: job.status,
      createdAt: job.createdAt,
      resultSummary: job.resultSummaryJson,
    })),
    entityStatuses: entities.map((entity) => entity.status),
    hasBoq: Boolean(boq),
  });
}
