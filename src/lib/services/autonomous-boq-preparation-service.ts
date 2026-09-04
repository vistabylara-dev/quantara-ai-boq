import {
  BOQStatus,
  ExtractionJobStatus,
  type ExtractionJob,
  type Prisma,
  type ProjectFileClassification,
  type ProjectFileStatus,
} from "@prisma/client";
import { after } from "next/server";
import { z } from "zod";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  AUTONOMOUS_BOQ_PREPARATION_VERSION,
  AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION,
  autonomousPreparationConfigurationSchema,
  createAutonomousBOQOperationHash,
  type AutonomousPreparationConfiguration,
} from "@/lib/autonomous-boq/preparation";
import { stableAutonomousHash } from "@/lib/autonomous-boq/contract";
import { resolveAutonomousIndustry } from "@/lib/autonomous-boq/industry-policy";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import {
  findOrCreateAutonomousPreparationJob,
  getAutonomousPreparationJob,
  getLatestAutonomousPreparationJob,
  requeueAutonomousPreparationJob,
  type CreateAutonomousPreparationJobInput,
} from "@/lib/repositories/autonomous-boq-preparation-repository";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { synchronizeEnabledIndustryEngine } from "@/lib/services/industry-bootstrap-service";
import type { PreliminaryConceptSchedule } from "@/lib/autonomous-boq/concept-schedule";
import { consolidatePreparationFindings } from "@/lib/autonomous-boq/review-findings";

export const autonomousBoqPreparationRequestSchema = z.object({
  sourceFileIds: z.array(z.string().uuid("Every drawing requires a valid file ID."))
    .min(1, "Upload at least one project drawing.")
    .max(500, "A preparation may contain at most 500 source files."),
  targetBoqId: z.string().uuid("A valid target BOQ ID is required.").optional(),
}).strict().transform((input) => ({
  ...input,
  sourceFileIds: [...new Set(input.sourceFileIds)],
}));

export type AutonomousBoqPreparationRequest = z.infer<
  typeof autonomousBoqPreparationRequestSchema
>;

type JsonValue = Prisma.JsonValue | null;

export type AutonomousPreparationProjectRecord = {
  id: string;
  slug: string;
  companyId: string;
  industryEngineId: string;
  industryEngine: {
    id: string;
    key: string;
    name: string;
    configJson: JsonValue;
  };
};

export type AutonomousPreparationSourceRecord = {
  id: string;
  companyId: string;
  projectId: string;
  originalName: string;
  checksum: string;
  drawingNumber: string | null;
  revisionNumber: string | null;
  status: ProjectFileStatus;
  extension: string;
  classification: ProjectFileClassification;
  createdAt: Date;
};

export type AutonomousSourceRevisionConflict = {
  code: "AMBIGUOUS_SOURCE_REVISION" | "DUPLICATE_LATEST_REVISION";
  drawingNumber: string;
  revisions: string[];
  sourceFileIds: string[];
  message: string;
};

export type AutonomousSourceRevisionSelection = {
  sources: AutonomousPreparationSourceRecord[];
  conflicts: AutonomousSourceRevisionConflict[];
};

function strictRevisionNumber(value: string | null): number | null {
  const match = /^R(\d+)$/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function newestDeterministic(
  rows: readonly AutonomousPreparationSourceRecord[],
): AutonomousPreparationSourceRecord {
  return [...rows].sort((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  })[0]!;
}

/**
 * Resolves only revision formats Quantara can compare truthfully (R01/R02).
 * Arbitrary drawing-office conventions are returned as a visible conflict;
 * upload time is never presented as revision authority.
 */
export function selectAutonomousSourceRevisions(
  rows: readonly AutonomousPreparationSourceRecord[],
): AutonomousSourceRevisionSelection {
  const unnamed: AutonomousPreparationSourceRecord[] = [];
  const groups = new Map<string, AutonomousPreparationSourceRecord[]>();
  for (const row of rows) {
    const drawingNumber = row.drawingNumber?.trim();
    if (!drawingNumber) {
      unnamed.push(row);
      continue;
    }
    const normalized = drawingNumber.toLocaleUpperCase();
    const group = groups.get(normalized) ?? [];
    group.push(row);
    groups.set(normalized, group);
  }

  const selected = [...unnamed];
  const conflicts: AutonomousSourceRevisionConflict[] = [];
  for (const [drawingNumber, group] of groups) {
    if (group.length === 1) {
      selected.push(group[0]);
      continue;
    }

    const parsed = group.map((row) => ({ row, revision: strictRevisionNumber(row.revisionNumber) }));
    const allStrict = parsed.every((entry) => entry.revision !== null);
    if (!allStrict) {
      const normalizedRevisions = new Set(group.map((row) => row.revisionNumber?.trim() || "UNSPECIFIED"));
      const checksums = new Set(group.map((row) => row.checksum.toLowerCase()));
      if (normalizedRevisions.size === 1 && checksums.size === 1) {
        selected.push(newestDeterministic(group));
        continue;
      }
      conflicts.push({
        code: "AMBIGUOUS_SOURCE_REVISION",
        drawingNumber,
        revisions: [...normalizedRevisions].sort(),
        sourceFileIds: group.map((row) => row.id).sort(),
        message: `Drawing ${drawingNumber} has competing revisions that Quantara cannot order safely. Select the authoritative revision before preparing the BOQ.`,
      });
      continue;
    }

    const highest = Math.max(...parsed.map((entry) => entry.revision!));
    const winners = parsed.filter((entry) => entry.revision === highest).map((entry) => entry.row);
    if (winners.length > 1 && new Set(winners.map((row) => row.checksum.toLowerCase())).size > 1) {
      conflicts.push({
        code: "DUPLICATE_LATEST_REVISION",
        drawingNumber,
        revisions: [...new Set(winners.map((row) => row.revisionNumber?.trim() || "UNSPECIFIED"))],
        sourceFileIds: winners.map((row) => row.id).sort(),
        message: `Drawing ${drawingNumber} has different files for the same latest revision. Select the authoritative source before preparing the BOQ.`,
      });
      continue;
    }
    selected.push(newestDeterministic(winners));
  }

  if (conflicts.length > 0) return { sources: [], conflicts };
  return {
    sources: selected.sort((left, right) => left.id.localeCompare(right.id)),
    conflicts: [],
  };
}

export type AutonomousPreparationExceptionDTO = {
  code: string;
  message: string;
  sourceFileIds: string[];
  pageIds: string[];
  sourceSheets: string[];
  discipline: string | null;
  workPackage: string | null;
};

export type AutonomousPreparationStage =
  | "QUEUED"
  | "SOURCE_VALIDATION"
  | "SOURCE_PROCESSING"
  | "CATEGORIZING"
  | "SOURCE_INPUT_REQUIRED"
  | "MEASURING"
  | "ASSEMBLING_BOQ"
  | "ASSEMBLY_PENDING"
  | "READY_FOR_RATES"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "CANCELLED";

export type AutonomousPreparationStatusDTO = {
  id: string;
  projectId: string;
  targetBoqId: string | null;
  sourceFileIds: string[];
  status: ExtractionJobStatus;
  stage: AutonomousPreparationStage;
  progressPercentage: number;
  readyForRates: boolean;
  retryable: boolean;
  exceptions: AutonomousPreparationExceptionDTO[];
  drawingMaturity: string[];
  payableEligibility: "PAYABLE_ELIGIBLE" | "NOT_PAYABLE_CONCEPT" | null;
  categoryStatus: "VERIFIED" | "REVIEW_REQUIRED" | null;
  conceptSchedule: PreliminaryConceptSchedule | null;
  error: { code: string | null; message: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function preparationExceptions(value: unknown): AutonomousPreparationExceptionDTO[] {
  if (!Array.isArray(value)) return [];
  const parsed = value.flatMap((entry) => {
    const row = objectRecord(entry);
    if (typeof row.code !== "string" || typeof row.message !== "string") return [];
    const sourceFileIds = Array.isArray(row.sourceFileIds)
      ? row.sourceFileIds.filter((id): id is string => typeof id === "string")
      : [];
    const pageIds = Array.isArray(row.pageIds)
      ? row.pageIds.filter((id): id is string => typeof id === "string")
      : [];
    const sourceSheets = Array.isArray(row.sourceSheets) ? row.sourceSheets.filter((id): id is string => typeof id === "string") : [];
    return [{
      code: row.code,
      message: row.message,
      sourceFileIds,
      pageIds,
      sourceSheets,
      discipline: typeof row.discipline === "string" ? row.discipline : null,
      workPackage: typeof row.workPackage === "string" ? row.workPackage : null,
    }];
  });
  const operational = parsed.filter((finding) => ["SOURCE_PREPROCESSING_INCOMPLETE", "CAD_CONNECTOR_REQUIRED"].includes(finding.code));
  const review = parsed.filter((finding) => !operational.includes(finding));
  return [...operational, ...consolidatePreparationFindings(review)].map((finding) => ({
    code: finding.code,
    message: finding.message,
    sourceFileIds: finding.sourceFileIds,
    pageIds: finding.pageIds,
    sourceSheets: finding.sourceSheets,
    discipline: finding.discipline,
    workPackage: finding.workPackage,
  }));
}

function conceptSchedule(value: unknown): PreliminaryConceptSchedule | null {
  const row = objectRecord(value);
  if (row.title !== "Preliminary Concept Quantity Schedule — Not for Contract/Payment" || row.payable !== false || !Array.isArray(row.metrics)) return null;
  return row as unknown as PreliminaryConceptSchedule;
}

function fallbackStage(job: ExtractionJob): AutonomousPreparationStage {
  switch (job.status) {
    case ExtractionJobStatus.QUEUED:
      return "QUEUED";
    case ExtractionJobStatus.RUNNING:
      return "SOURCE_PROCESSING";
    case ExtractionJobStatus.NEEDS_INPUT:
      return "SOURCE_INPUT_REQUIRED";
    case ExtractionJobStatus.NEEDS_REVIEW:
      return "NEEDS_REVIEW";
    case ExtractionJobStatus.COMPLETED:
      return "READY_FOR_RATES";
    case ExtractionJobStatus.FAILED:
      return "FAILED";
    case ExtractionJobStatus.CANCELLED:
      return "CANCELLED";
  }
}

const stages = new Set<AutonomousPreparationStage>([
  "QUEUED",
  "SOURCE_VALIDATION",
  "SOURCE_PROCESSING",
  "CATEGORIZING",
  "SOURCE_INPUT_REQUIRED",
  "MEASURING",
  "ASSEMBLING_BOQ",
  "ASSEMBLY_PENDING",
  "READY_FOR_RATES",
  "NEEDS_REVIEW",
  "FAILED",
  "CANCELLED",
]);

export function toAutonomousPreparationStatus(job: ExtractionJob): AutonomousPreparationStatusDTO {
  const configuration = objectRecord(job.configurationJson);
  const summary = objectRecord(job.resultSummaryJson);
  const stage = typeof summary.stage === "string" && stages.has(summary.stage as AutonomousPreparationStage)
    ? summary.stage as AutonomousPreparationStage
    : fallbackStage(job);
  const frozenSources = Array.isArray(configuration.frozenSources)
    ? configuration.frozenSources.map(objectRecord)
    : [];
  const targetBoqId = typeof configuration.targetBoqId === "string"
    ? configuration.targetBoqId
    : null;
  const readyForRates = job.status === ExtractionJobStatus.COMPLETED
    && stage === "READY_FOR_RATES"
    && summary.readyForRates === true;
  const exceptions = preparationExceptions(summary.exceptions);
  const conceptBlocked = summary.payableEligibility === "NOT_PAYABLE_CONCEPT"
    || exceptions.some((exception) => exception.code === "CONCEPT_DRAWING_NOT_PAYABLE");
  const savedProviderResult = objectRecord(summary.providerResult);
  const staleEmptyClassification = job.status === ExtractionJobStatus.NEEDS_REVIEW
    && !conceptBlocked
    && summary.measuredSubjectCount === 0
    && summary.addedItemCount === 0
    && Boolean(summary.providerResult)
    && savedProviderResult.reasonerContractVersion !== AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION;
  const retryable = job.status === ExtractionJobStatus.FAILED
    || (job.status === ExtractionJobStatus.NEEDS_INPUT
      && exceptions.some((exception) => exception.code === "SOURCE_PREPROCESSING_INCOMPLETE"))
    || staleEmptyClassification;

  return {
    id: job.id,
    projectId: job.projectId,
    targetBoqId,
    sourceFileIds: frozenSources.flatMap((source) => typeof source.id === "string" ? [source.id] : []),
    status: job.status,
    stage,
    progressPercentage: job.progressPercentage,
    readyForRates,
    retryable,
    exceptions,
    drawingMaturity: Array.isArray(summary.drawingMaturity) ? summary.drawingMaturity.filter((value): value is string => typeof value === "string") : conceptBlocked ? ["CONCEPT_BASIS_OF_DESIGN"] : [],
    payableEligibility: conceptBlocked ? "NOT_PAYABLE_CONCEPT" : summary.payableEligibility === "PAYABLE_ELIGIBLE" ? "PAYABLE_ELIGIBLE" : null,
    categoryStatus: summary.categoryStatus === "VERIFIED" || summary.categoryStatus === "REVIEW_REQUIRED" ? summary.categoryStatus : null,
    conceptSchedule: conceptSchedule(summary.conceptSchedule),
    error: job.errorCode || job.errorMessage
      ? { code: job.errorCode, message: job.errorMessage }
      : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

type EnabledIndustryRecord = {
  id: string;
  key: string;
  name: string;
  configJson: JsonValue;
};

export type AutonomousPreparationServiceDependencies = {
  getProject(companyId: string, identifier: string): Promise<AutonomousPreparationProjectRecord>;
  synchronizeEnabledIndustry(companyId: string, identifier: string): Promise<boolean>;
  getEnabledIndustry(companyId: string, identifier: string): Promise<EnabledIndustryRecord>;
  listSources(companyId: string, projectId: string, sourceFileIds: readonly string[]): Promise<AutonomousPreparationSourceRecord[]>;
  findEditableBoq(companyId: string, projectId: string, targetBoqId?: string): Promise<{ id: string } | null>;
  findOrCreateJob(input: CreateAutonomousPreparationJobInput): Promise<{ job: ExtractionJob; created: boolean }>;
  getJob(companyId: string, jobId: string): Promise<ExtractionJob>;
  getLatestJob(companyId: string, projectId: string): Promise<ExtractionJob | null>;
  requeueJob(companyId: string, jobId: string): Promise<ExtractionJob>;
  registerHandlers(): Promise<unknown>;
  scheduleJob(companyId: string, jobId: string): void;
};

function schedulePersistedPreparation(companyId: string, jobId: string): void {
  const runJob = () => extractionJobQueue.processQueuedJob(companyId, jobId).catch((error) => {
    console.error(`[autonomous-boq] unhandled preparation scheduling error for ${jobId}`, error);
  });
  if (process.env.NODE_ENV === "production") {
    try {
      after(runJob);
      return;
    } catch (error) {
      console.error(`[autonomous-boq] after() unavailable for preparation ${jobId}; using local scheduling`, error);
    }
  }
  setImmediate(runJob);
}

const defaultDependencies: AutonomousPreparationServiceDependencies = {
  getProject: async (companyId, identifier) => {
    return getProjectRecord(companyId, identifier);
  },
  synchronizeEnabledIndustry: synchronizeEnabledIndustryEngine,
  getEnabledIndustry,
  listSources: (companyId, projectId, sourceFileIds) => prisma.projectFile.findMany({
    where: {
      companyId,
      projectId,
      id: { in: [...sourceFileIds] },
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  }),
  findEditableBoq: (companyId, projectId, targetBoqId) => prisma.bOQ.findFirst({
    where: {
      companyId,
      projectId,
      ...(targetBoqId ? { id: targetBoqId } : {}),
      isLocked: false,
      status: { notIn: [BOQStatus.LOCKED, BOQStatus.ISSUED, BOQStatus.APPROVED] },
    },
    orderBy: { revisionNumber: "desc" },
    select: { id: true },
  }),
  findOrCreateJob: findOrCreateAutonomousPreparationJob,
  getJob: getAutonomousPreparationJob,
  getLatestJob: getLatestAutonomousPreparationJob,
  requeueJob: requeueAutonomousPreparationJob,
  registerHandlers: () => import("@/lib/jobs/register-handlers"),
  scheduleJob: schedulePersistedPreparation,
};

function assertSourceScope(
  actor: CurrentActor,
  projectId: string,
  requestedIds: readonly string[],
  rows: readonly AutonomousPreparationSourceRecord[],
): void {
  const expected = new Set(requestedIds);
  const valid = rows.length === expected.size && rows.every((row) =>
    expected.has(row.id)
    && row.companyId === actor.companyId
    && row.projectId === projectId
    && row.status !== "ARCHIVED"
    && /^[a-f0-9]{64}$/i.test(row.checksum));
  if (!valid) {
    throw new AppError(
      "AUTONOMOUS_SOURCE_SCOPE_INVALID",
      "One or more selected drawings are missing, archived, unverified, or outside this project.",
      409,
    );
  }
}

export function createAutonomousBoqPreparationService(
  dependencies: AutonomousPreparationServiceDependencies = defaultDependencies,
) {
  return {
    async start(
      actor: CurrentActor,
      projectIdentifier: string,
      rawInput: AutonomousBoqPreparationRequest,
    ): Promise<AutonomousPreparationStatusDTO> {
      requireCapability(actor, "boq:edit");
      const input = autonomousBoqPreparationRequestSchema.parse(rawInput);
      const project = await dependencies.getProject(actor.companyId, projectIdentifier);
      if (project.companyId !== actor.companyId) throw new NotFoundError("Project not found.");

      await dependencies.synchronizeEnabledIndustry(
        actor.companyId,
        project.industryEngineId,
      );

      const enabledIndustry = await dependencies.getEnabledIndustry(
        actor.companyId,
        project.industryEngineId,
      );
      if (
        enabledIndustry.id !== project.industryEngine.id
        || enabledIndustry.key !== project.industryEngine.key
      ) {
        throw new ConflictError(
          "AUTONOMOUS_PROJECT_INDUSTRY_CHANGED",
          "The project's selected industry changed before BOQ preparation started. Reload the project and try again.",
        );
      }
      const resolution = resolveAutonomousIndustry(enabledIndustry.key);
      if (resolution.status === "BLOCKED") {
        throw new AppError(resolution.code, resolution.reason, 409);
      }

      const rows = await dependencies.listSources(
        actor.companyId,
        project.id,
        input.sourceFileIds,
      );
      assertSourceScope(actor, project.id, input.sourceFileIds, rows);
      const sourceSelection = selectAutonomousSourceRevisions(rows);
      if (sourceSelection.conflicts.length > 0) {
        throw new AppError(
          "AUTONOMOUS_SOURCE_REVISION_CONFLICT",
          sourceSelection.conflicts.map((conflict) => conflict.message).join(" "),
          409,
        );
      }

      const targetBoq = await dependencies.findEditableBoq(
        actor.companyId,
        project.id,
        input.targetBoqId,
      );
      if (!targetBoq) {
        throw new ConflictError(
          "AUTONOMOUS_EDITABLE_BOQ_REQUIRED",
          "Quantara requires an editable project BOQ revision before autonomous preparation can start.",
        );
      }

      const configurationWithoutHash = {
        contractVersion: AUTONOMOUS_BOQ_PREPARATION_VERSION,
        companyId: actor.companyId,
        projectId: project.id,
        targetBoqId: targetBoq.id,
        industry: {
          engineId: enabledIndustry.id,
          key: enabledIndustry.key,
          name: enabledIndustry.name,
          policyVersion: resolution.context.policyVersion,
          configurationHash: stableAutonomousHash({
            id: enabledIndustry.id,
            key: enabledIndustry.key,
            name: enabledIndustry.name,
            configJson: enabledIndustry.configJson,
          }),
        },
        frozenSources: sourceSelection.sources.map((source) => ({
          id: source.id,
          checksum: source.checksum.toLowerCase(),
          revision: source.revisionNumber?.trim() || null,
          originalName: source.originalName,
        })),
      } satisfies Omit<AutonomousPreparationConfiguration, "operationHash">;
      const configuration: AutonomousPreparationConfiguration = {
        ...configurationWithoutHash,
        operationHash: createAutonomousBOQOperationHash(configurationWithoutHash),
      };

      const { job } = await dependencies.findOrCreateJob({
        configuration,
        anchorProjectFileId: configuration.frozenSources[0].id,
        createdByUserId: actor.userId,
      });
      if (job.status === ExtractionJobStatus.QUEUED) {
        await dependencies.registerHandlers();
        dependencies.scheduleJob(actor.companyId, job.id);
      }
      return toAutonomousPreparationStatus(job);
    },

    async get(
      actor: CurrentActor,
      projectIdentifier: string,
      jobId?: string,
    ): Promise<AutonomousPreparationStatusDTO | null> {
      const project = await dependencies.getProject(actor.companyId, projectIdentifier);
      const job = jobId
        ? await dependencies.getJob(actor.companyId, jobId)
        : await dependencies.getLatestJob(actor.companyId, project.id);
      if (!job) return null;
      if (job.projectId !== project.id || job.companyId !== actor.companyId) {
        throw new NotFoundError("BOQ preparation not found.");
      }
      return toAutonomousPreparationStatus(job);
    },

    async retry(
      actor: CurrentActor,
      projectIdentifier: string,
      jobId: string,
    ): Promise<AutonomousPreparationStatusDTO> {
      requireCapability(actor, "boq:edit");
      const project = await dependencies.getProject(actor.companyId, projectIdentifier);
      const current = await dependencies.getJob(actor.companyId, jobId);
      if (current.companyId !== actor.companyId || current.projectId !== project.id) {
        throw new NotFoundError("BOQ preparation not found.");
      }
      if (current.errorCode === "AUTONOMOUS_INDUSTRY_SECTION_MISSING") {
        const failedConfiguration = autonomousPreparationConfigurationSchema.parse(
          current.configurationJson,
        );
        return createAutonomousBoqPreparationService(dependencies).start(
          actor,
          projectIdentifier,
          {
            sourceFileIds: failedConfiguration.frozenSources.map((source) => source.id),
            targetBoqId: failedConfiguration.targetBoqId,
          },
        );
      }
      const job = await dependencies.requeueJob(actor.companyId, jobId);
      await dependencies.registerHandlers();
      dependencies.scheduleJob(actor.companyId, job.id);
      return toAutonomousPreparationStatus(job);
    },
  };
}

const autonomousPreparationService = createAutonomousBoqPreparationService();

export const startAutonomousBoqPreparation = autonomousPreparationService.start;
export const getAutonomousBoqPreparation = autonomousPreparationService.get;
export const retryAutonomousBoqPreparation = autonomousPreparationService.retry;
