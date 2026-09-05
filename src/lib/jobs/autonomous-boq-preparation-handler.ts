import {
  ExtractedEntityType,
  ExtractionMethod,
  ExtractionEngineType,
  ExtractionJobStatus,
  type ExtractionJob,
  type UserRole,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import {
  AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION,
  autonomousPreparationConfigurationSchema,
  resolveAutonomousProviderExecution,
  type AutonomousPreparationConfiguration,
} from "@/lib/autonomous-boq/preparation";
import { stableAutonomousHash } from "@/lib/autonomous-boq/contract";
import { evaluateAiDraftEntityCoverage } from "@/lib/guidance/ai-draft-coverage";
import { consolidatePreparationFindings } from "@/lib/autonomous-boq/review-findings";
import { resolveAutonomousIndustry } from "@/lib/autonomous-boq/industry-policy";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError } from "@/lib/errors/app-error";
import { getSourceProcessingCapability } from "@/lib/files/source-processing-capability";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import type { JobHandler, JobHandlerContext, JobHandlerResult } from "@/lib/jobs/job-queue";
import { checkpointAutonomousPreparationJob } from "@/lib/repositories/autonomous-boq-preparation-repository";
import { getExtractionJobRecord } from "@/lib/repositories/extraction-job-repository";
import { generateAiDraftBoq } from "@/lib/services/ai-draft-boq-service";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { regenerateFurnitureManagedBOQ } from "@/lib/services/furniture-boq-service";
import { DEFAULT_FURNITURE_WASTAGE_PERCENTAGE } from "@/lib/furniture/canonical-output";
import {
  prepareTayqanMeasurementProposals,
  type PrepareTayqanMeasurementsInput,
  type PrepareTayqanMeasurementsOptions,
  type PrepareTayqanMeasurementsResult,
} from "@/lib/services/tayqan-measurement-service";
import type {
  TayqanMeasurementGoverningContext,
  TayqanMeasurementReasonerResult,
} from "@/lib/tayqan/tayqan-measurement-reasoner";

type PreparationException = {
  code: string;
  message: string;
  sourceFileIds: string[];
  pageIds?: string[];
  sourceSheets?: string[];
  projectRevision?: string | null;
  discipline?: string | null;
  workPackage?: string | null;
};

type IndustryPolicyContext = NonNullable<TayqanMeasurementGoverningContext["industryPolicy"]>;

type ValidatedFrozenScope = {
  projectSlug: string;
  industryContext: IndustryPolicyContext;
  assemblyMode?: "GENERIC_POLICY" | "SPECIALIZED_JOINERY";
};

type SourceProcessingResult =
  | { state: "READY"; exceptions: PreparationException[]; evidenceChanged?: boolean }
  | { state: "NEEDS_INPUT"; exceptions: PreparationException[]; evidenceChanged?: boolean };

type AssemblyResult = {
  state: "READY_FOR_RATES" | "NEEDS_REVIEW";
  boqId: string;
  addedItemCount: number;
  duplicateItemCount: number;
  exceptions: PreparationException[];
};

const SOURCE_ENGINE_SETTLE_TIMEOUT_MS = 240_000;
const SOURCE_ENGINE_POLL_INTERVAL_MS = 250;

function isSourceEngineExecuting(status: ExtractionJobStatus): boolean {
  return status === ExtractionJobStatus.QUEUED || status === ExtractionJobStatus.RUNNING;
}

type SourceEngineWaitDependencies = {
  read(companyId: string, jobId: string): Promise<ExtractionJob>;
  sleep(milliseconds: number): Promise<void>;
  now(): number;
};

const defaultSourceEngineWaitDependencies: SourceEngineWaitDependencies = {
  read: getExtractionJobRecord,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now: () => Date.now(),
};

export async function waitForSourceEngineResult(
  companyId: string,
  jobId: string,
  dependencies: SourceEngineWaitDependencies = defaultSourceEngineWaitDependencies,
): Promise<ExtractionJob> {
  const deadline = dependencies.now() + SOURCE_ENGINE_SETTLE_TIMEOUT_MS;
  let current = await dependencies.read(companyId, jobId);
  while (isSourceEngineExecuting(current.status) && dependencies.now() < deadline) {
    await dependencies.sleep(SOURCE_ENGINE_POLL_INTERVAL_MS);
    current = await dependencies.read(companyId, jobId);
  }
  if (isSourceEngineExecuting(current.status)) {
    throw new AppError(
      "SOURCE_ENGINE_SETTLE_TIMEOUT",
      "Source processing is still running. Quantara preserved the job and will safely resume it.",
      503,
    );
  }
  return current;
}

async function ensureConceptScheduleEntities(
  actor: CurrentActor,
  configuration: AutonomousPreparationConfiguration,
  measurement: PrepareTayqanMeasurementsResult,
): Promise<void> {
  const schedule = measurement.conceptSchedule;
  if (!schedule) return;
  const sourceFileIds = configuration.frozenSources.map((source) => source.id);
  const pages = await prisma.drawingPage.findMany({
    where: {
      companyId: actor.companyId,
      projectFileId: { in: sourceFileIds },
      id: { in: schedule.metrics.map((metric) => metric.pageId) },
    },
    select: { id: true, projectFileId: true },
  });
  const pageById = new Map(pages.map((page) => [page.id, page] as const));

  for (const metric of schedule.metrics) {
    const page = pageById.get(metric.pageId);
    if (!page || !Number.isFinite(metric.value) || metric.value <= 0) continue;
    const fingerprint = stableAutonomousHash({
      projectFileId: page.projectFileId,
      pageId: page.id,
      label: metric.label.trim().toLocaleLowerCase(),
      value: metric.value,
      unit: metric.unit,
    });
    const marker = `CONCEPT_SCHEDULE_METRIC:${fingerprint}`;
    const existing = await prisma.extractedEntity.findFirst({
      where: {
        companyId: actor.companyId,
        projectId: configuration.projectId,
        projectFileId: page.projectFileId,
        drawingPageId: page.id,
        sourceReference: { contains: marker },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.extractedEntity.create({
      data: {
        companyId: actor.companyId,
        projectId: configuration.projectId,
        projectFileId: page.projectFileId,
        drawingPageId: page.id,
        entityType: ExtractedEntityType.SCHEDULE_ROW,
        categoryKey: "PRELIMINARY_CONCEPT_METRIC",
        label: metric.label.trim(),
        normalizedLabel: metric.label.trim().toLocaleLowerCase(),
        quantity: metric.value,
        unit: metric.unit,
        confidence: metric.confidence,
        extractionMethod: ExtractionMethod.TEXT_LAYER,
        sourceText: `${metric.label}: ${metric.value} ${metric.unit}`,
        sourceReference: `${metric.sheetReference} | ${marker}`,
        technicalDataJson: {
          conceptSchedule: true,
          payable: false,
          sheetReference: metric.sheetReference,
          sourcePageId: metric.pageId,
        },
        status: "NEEDS_REVIEW",
      },
    });
  }
}

export type AutonomousBoqPreparationHandlerDependencies = {
  loadActor(companyId: string, userId: string): Promise<CurrentActor>;
  validateFrozenScope(configuration: AutonomousPreparationConfiguration): Promise<ValidatedFrozenScope>;
  ensureSourcesProcessed(actor: CurrentActor, configuration: AutonomousPreparationConfiguration): Promise<SourceProcessingResult>;
  measure(
    actor: CurrentActor,
    projectIdentifier: string,
    input: PrepareTayqanMeasurementsInput,
    options: PrepareTayqanMeasurementsOptions,
  ): Promise<PrepareTayqanMeasurementsResult>;
  checkpoint(companyId: string, jobId: string, patch: Record<string, unknown>): Promise<unknown>;
  assemble(
    actor: CurrentActor,
    configuration: AutonomousPreparationConfiguration,
    scope: ValidatedFrozenScope,
    measurement: PrepareTayqanMeasurementsResult,
  ): Promise<AssemblyResult>;
  now(): Date;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function assertNotCancelled(ctx: JobHandlerContext): Promise<void> {
  if (await ctx.isCancelled()) {
    throw new AppError("AUTONOMOUS_PREPARATION_CANCELLED", "BOQ preparation was cancelled.", 409);
  }
}

async function runSourceEngine(input: {
  actor: CurrentActor;
  projectId: string;
  projectFileId: string;
  engineType: ExtractionEngineType;
}): Promise<ExtractionJob> {
  const queued = await extractionJobQueue.enqueue(
    {
      companyId: input.actor.companyId,
      projectId: input.projectId,
      projectFileId: input.projectFileId,
      engineType: input.engineType,
      createdByUserId: input.actor.userId,
    },
    { schedule: false },
  );
  if (queued.status === ExtractionJobStatus.QUEUED) {
    await extractionJobQueue.processQueuedJob(input.actor.companyId, queued.id);
  }
  // Finalization can already have a live preprocessing job. In that case the
  // atomic claim above correctly becomes a no-op; do not immediately mistake
  // the other worker's RUNNING row for a failed source. Await its persisted
  // terminal result before deciding whether measurement may continue.
  return waitForSourceEngineResult(input.actor.companyId, queued.id);
}

async function defaultEnsureSourcesProcessed(
  actor: CurrentActor,
  configuration: AutonomousPreparationConfiguration,
): Promise<SourceProcessingResult> {
  const sourceIds = configuration.frozenSources.map((source) => source.id);
  const files = await prisma.projectFile.findMany({
    where: {
      companyId: actor.companyId,
      projectId: configuration.projectId,
      id: { in: sourceIds },
      status: { not: "ARCHIVED" },
    },
    orderBy: { id: "asc" },
  });
  if (files.length !== sourceIds.length) {
    return {
      state: "NEEDS_INPUT",
      exceptions: [{
        code: "SOURCE_SCOPE_CHANGED",
        message: "A frozen drawing source is missing or archived.",
        sourceFileIds: sourceIds,
      }],
    };
  }

  const exceptions: PreparationException[] = [];
  let evidenceChanged = false;
  for (const file of files) {
    const capability = getSourceProcessingCapability(file.extension);
    if (capability.mode === "CAD_BIM_CONNECTOR_REQUIRED" || capability.mode === "SOURCE_ONLY") {
      exceptions.push({
        code: capability.mode,
        message: capability.message,
        sourceFileIds: [file.id],
      });
      continue;
    }

    if (capability.canRenderPages) {
      const pageCount = await prisma.drawingPage.count({
        where: { companyId: actor.companyId, projectFileId: file.id },
      });
      if (pageCount === 0) {
        const preprocessing = await runSourceEngine({
          actor,
          projectId: configuration.projectId,
          projectFileId: file.id,
          engineType: ExtractionEngineType.FILE_PREPROCESSING,
        });
        if (preprocessing.status !== ExtractionJobStatus.COMPLETED) {
          exceptions.push({
            code: preprocessing.errorCode ?? "SOURCE_PREPROCESSING_INCOMPLETE",
            message: preprocessing.errorMessage
              ?? `Quantara could not prepare reviewable pages for ${file.originalName}.`,
            sourceFileIds: [file.id],
          });
        } else {
          evidenceChanged = true;
        }
      }
    }

    // Classification must follow rendering so a generic filename cannot hide
    // the drawing's actual title-block and schedule evidence.
    if (file.classification === "UNKNOWN") {
      const classification = await runSourceEngine({
        actor,
        projectId: configuration.projectId,
        projectFileId: file.id,
        engineType: ExtractionEngineType.DOCUMENT_CLASSIFICATION,
      });
      if (classification.status === ExtractionJobStatus.FAILED) {
        exceptions.push({
          code: classification.errorCode ?? "SOURCE_CLASSIFICATION_FAILED",
          message: classification.errorMessage ?? `Classification failed for ${file.originalName}.`,
          sourceFileIds: [file.id],
        });
        continue;
      }
      const classifiedAs = record(classification.resultSummaryJson).classification;
      if (typeof classifiedAs === "string" && classifiedAs !== "UNKNOWN") evidenceChanged = true;
    }

    if (["csv", "xlsx"].includes(file.extension.toLowerCase())) {
      const tableCount = await prisma.extractedTable.count({
        where: { companyId: actor.companyId, projectFileId: file.id },
      });
      if (tableCount === 0) {
        const extraction = await runSourceEngine({
          actor,
          projectId: configuration.projectId,
          projectFileId: file.id,
          engineType: ExtractionEngineType.TABLE_EXTRACTION,
        });
        if (extraction.status !== ExtractionJobStatus.COMPLETED) {
          exceptions.push({
            code: extraction.errorCode ?? "STRUCTURED_SOURCE_EXTRACTION_INCOMPLETE",
            message: extraction.errorMessage
              ?? `Quantara could not extract the schedule evidence in ${file.originalName}.`,
            sourceFileIds: [file.id],
          });
        }
      }
    }
  }

  const drawingPageCount = await prisma.drawingPage.count({
    where: { companyId: actor.companyId, projectFileId: { in: sourceIds } },
  });
  if (drawingPageCount === 0) {
    exceptions.push({
      code: "PROCESSED_DRAWING_PAGES_REQUIRED",
      message: "At least one selected source must produce reviewable drawing pages before quantity take-off can start.",
      sourceFileIds: sourceIds,
    });
  }

  return exceptions.length > 0
    ? { state: "NEEDS_INPUT", exceptions, evidenceChanged }
    : { state: "READY", exceptions: [], evidenceChanged };
}

async function defaultLoadActor(companyId: string, userId: string): Promise<CurrentActor> {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, isActive: true },
    select: { id: true, companyId: true, role: true, fullName: true, email: true },
  });
  if (!user) {
    throw new AppError(
      "AUTONOMOUS_PREPARATION_ACTOR_INVALID",
      "The user who started this BOQ preparation is no longer active in the company.",
      403,
    );
  }
  return {
    userId: user.id,
    companyId: user.companyId,
    role: user.role as UserRole,
    fullName: user.fullName,
    email: user.email,
  };
}

async function defaultValidateFrozenScope(
  configuration: AutonomousPreparationConfiguration,
): Promise<ValidatedFrozenScope> {
  const [project, targetBoq, files] = await Promise.all([
    prisma.project.findFirst({
      where: { id: configuration.projectId, companyId: configuration.companyId },
      include: { industryEngine: true },
    }),
    prisma.bOQ.findFirst({
      where: {
        id: configuration.targetBoqId,
        companyId: configuration.companyId,
        projectId: configuration.projectId,
        isLocked: false,
        status: { notIn: ["LOCKED", "ISSUED", "APPROVED"] },
      },
      select: { id: true },
    }),
    prisma.projectFile.findMany({
      where: {
        companyId: configuration.companyId,
        projectId: configuration.projectId,
        id: { in: configuration.frozenSources.map((source) => source.id) },
        status: { not: "ARCHIVED" },
      },
      select: { id: true, checksum: true, revisionNumber: true },
    }),
  ]);
  if (!project || !targetBoq) {
    throw new ConflictError(
      "AUTONOMOUS_FROZEN_SCOPE_CHANGED",
      "The frozen project, industry, or editable BOQ target changed before processing completed.",
    );
  }
  if (
    project.industryEngine.id !== configuration.industry.engineId
    || project.industryEngine.key !== configuration.industry.key
  ) {
    throw new ConflictError(
      "AUTONOMOUS_PROJECT_INDUSTRY_CHANGED",
      "The project's selected industry changed after BOQ preparation started.",
    );
  }
  const currentConfigurationHash = stableAutonomousHash({
    id: project.industryEngine.id,
    key: project.industryEngine.key,
    name: project.industryEngine.name,
    configJson: project.industryEngine.configJson,
  });
  if (currentConfigurationHash !== configuration.industry.configurationHash) {
    throw new ConflictError(
      "AUTONOMOUS_INDUSTRY_POLICY_CHANGED",
      "The selected industry configuration changed after this operation was frozen.",
    );
  }
  const expectedById = new Map(configuration.frozenSources.map((source) => [source.id, source] as const));
  if (
    files.length !== expectedById.size
    || files.some((file) => {
      const expected = expectedById.get(file.id);
      return !expected
        || expected.checksum.toLowerCase() !== file.checksum.toLowerCase()
        || expected.revision !== (file.revisionNumber?.trim() || null);
    })
  ) {
    throw new ConflictError(
      "AUTONOMOUS_SOURCE_SCOPE_CHANGED",
      "A frozen source checksum or revision changed before measurement completed.",
    );
  }

  const resolution = resolveAutonomousIndustry(project.industryEngine.key);
  if (resolution.status === "BLOCKED") {
    throw new AppError(resolution.code, resolution.reason, 409);
  }
  if (resolution.context.policyVersion !== configuration.industry.policyVersion) {
    throw new ConflictError(
      "AUTONOMOUS_POLICY_VERSION_CHANGED",
      "The autonomous industry policy version changed after this operation was frozen.",
    );
  }

  const config = record(project.industryEngine.configJson);
  const sections = Array.isArray(config.boqSections)
    ? config.boqSections.map(record)
    : [];
  const sectionById = new Map(
    sections.flatMap((section) =>
      typeof section.id === "string" && typeof section.code === "string" && typeof section.title === "string"
        ? [[section.id, { code: section.code, title: section.title }] as const]
        : []
    ),
  );
  const allowedRuleIds = new Set(resolution.context.allowedRuleIds);
  const rules = resolution.context.policy.rules
    .filter((rule) => allowedRuleIds.has(rule.id))
    .map((rule) => {
      const section = sectionById.get(rule.sectionId);
      if (!section) {
        throw new ConflictError(
          "AUTONOMOUS_INDUSTRY_SECTION_MISSING",
          `Industry rule ${rule.id} refers to a BOQ section that is not enabled.`,
        );
      }
      return {
        id: rule.id,
        sectionCode: section.code,
        title: rule.label,
        calculationType: rule.calculationType,
        resultUnit: rule.boqUnit,
      };
    });

  return {
    projectSlug: project.slug,
    assemblyMode: resolution.context.policy.assemblyMode,
    industryContext: {
      engineId: resolution.context.engineId,
      key: project.industryEngine.key,
      name: project.industryEngine.name,
      policyVersion: resolution.context.policyVersion,
      configurationHash: configuration.industry.configurationHash,
      supportedUnits: [...new Set(rules.map((rule) => rule.resultUnit))],
      sections: [...new Map(rules.map((rule) => [rule.sectionCode, {
        code: rule.sectionCode,
        title: sectionById.get(
          resolution.context.policy.rules.find((candidate) => candidate.id === rule.id)!.sectionId,
        )!.title,
      }])).values()],
      supportedCalculationTypes: [...new Set(rules.map((rule) => rule.calculationType))],
      rules,
    },
  };
}

async function defaultAssemble(
  actor: CurrentActor,
  configuration: AutonomousPreparationConfiguration,
  scope: ValidatedFrozenScope,
  measurement: PrepareTayqanMeasurementsResult,
): Promise<AssemblyResult> {
  if (scope.assemblyMode === "SPECIALIZED_JOINERY") {
    try {
      const generated = await regenerateFurnitureManagedBOQ(actor, {
        projectIdentifier: scope.projectSlug,
        boqId: configuration.targetBoqId,
        wastagePercentage: DEFAULT_FURNITURE_WASTAGE_PERCENTAGE,
      });
      return {
        state: "READY_FOR_RATES",
        boqId: generated.boqId,
        addedItemCount: generated.createdItems + generated.updatedItems,
        duplicateItemCount: generated.changed ? 0 : generated.output.sections.reduce((total, section) => total + section.items.length, 0),
        exceptions: [],
      };
    } catch (error) {
      if (error instanceof AppError && [
        "FURNITURE_CONFIRMED_CANDIDATES_REQUIRED",
        "FURNITURE_CANDIDATES_REQUIRE_REVIEW",
        "FURNITURE_ORDER_ITEMS_REQUIRE_REVIEW",
      ].includes(error.code)) {
        return {
          state: "NEEDS_REVIEW",
          boqId: configuration.targetBoqId,
          addedItemCount: 0,
          duplicateItemCount: 0,
          exceptions: [{
            code: "JOINERY_ENGINEERING_REVIEW_REQUIRED",
            message: error.message,
            sourceFileIds: configuration.frozenSources.map((source) => source.id),
          }],
        };
      }
      throw error;
    }
  }

  const conceptReview = measurement.conceptSchedule !== null
    && measurement.conceptSchedule !== undefined;
  if (conceptReview) {
    await ensureConceptScheduleEntities(actor, configuration, measurement);
  }

  const draft = await generateAiDraftBoq(actor, configuration.projectId, {
    targetBoqId: configuration.targetBoqId,
    projectFileIds: configuration.frozenSources.map((source) => source.id),
    quantityMode: conceptReview ? "EXTRACTION_ONLY" : "AUTONOMOUS_SYSTEM_VALIDATED",
    ...(conceptReview
      ? {
          reviewSection: {
            code: "CONCEPT-REVIEW",
            title: "Preliminary Concept Quantity Schedule — Not for Contract/Payment",
            description: "Only explicitly printed and reconcilable concept quantities. Not eligible for payable verification or lock.",
          },
        }
      : {
          autonomousPolicy: {
            operationHash: configuration.operationHash,
            rules: scope.industryContext.rules.map((rule) => ({
              id: rule.id,
              calculationType: rule.calculationType,
              boqUnit: rule.resultUnit,
              sectionCode: rule.sectionCode,
              title: scope.industryContext.sections.find((section) => section.code === rule.sectionCode)?.title ?? rule.title,
            })),
          },
        }),
  });

  const [activeEntities, boq] = await Promise.all([
    prisma.extractedEntity.findMany({
      where: {
        companyId: actor.companyId,
        projectId: configuration.projectId,
        projectFileId: { in: configuration.frozenSources.map((source) => source.id) },
        status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
      },
      select: { id: true, label: true, status: true },
    }),
    getBOQRecord(actor.companyId, draft.boqId),
  ]);
  const coverage = evaluateAiDraftEntityCoverage(
    activeEntities,
    boq.sections.flatMap((section) => section.items),
  );
  if (coverage.missingEntityIds.length > 0) {
    throw new AppError(
      "SCOPE_COVERAGE_INCOMPLETE",
      `eligible entity count: ${coverage.eligibleEntityCount}, represented entity count: ${coverage.representedEntityCount}, missing count: ${coverage.missingEntityIds.length}`,
      500,
    );
  }

  return {
    state: !conceptReview && draft.readyForRates ? "READY_FOR_RATES" : "NEEDS_REVIEW",
    boqId: draft.boqId,
    addedItemCount: draft.addedCount,
    duplicateItemCount: draft.alreadyPresentCount,
    exceptions: draft.readyForRates ? [] : [{
      code: "AUTONOMOUS_BOQ_ASSEMBLY_INCOMPLETE",
      message: "Quantara could not assemble a quantity-complete unpriced BOQ from the validated measurement set.",
      sourceFileIds: configuration.frozenSources.map((source) => source.id),
    }],
  };
}

const defaultDependencies: AutonomousBoqPreparationHandlerDependencies = {
  loadActor: defaultLoadActor,
  validateFrozenScope: defaultValidateFrozenScope,
  ensureSourcesProcessed: defaultEnsureSourcesProcessed,
  measure: prepareTayqanMeasurementProposals,
  checkpoint: checkpointAutonomousPreparationJob,
  assemble: defaultAssemble,
  now: () => new Date(),
};

export function createAutonomousBoqPreparationHandler(
  dependencies: AutonomousBoqPreparationHandlerDependencies = defaultDependencies,
): JobHandler {
  return async (job, ctx): Promise<JobHandlerResult> => {
    const configuration = autonomousPreparationConfigurationSchema.parse(job.configurationJson);
    if (
      job.companyId !== configuration.companyId
      || job.projectId !== configuration.projectId
      || job.projectFileId !== configuration.frozenSources[0]?.id
    ) {
      throw new ConflictError(
        "AUTONOMOUS_JOB_SCOPE_INVALID",
        "The persisted preparation job does not match its frozen operation scope.",
      );
    }

    const summary = { ...record(job.resultSummaryJson) };
    const checkpoint = async (patch: Record<string, unknown>) => {
      await dependencies.checkpoint(job.companyId, job.id, patch);
      Object.assign(summary, patch);
    };

    const actor = await dependencies.loadActor(job.companyId, job.createdByUserId);
    await checkpoint({ stage: "SOURCE_VALIDATION", readyForRates: false });
    await ctx.updateProgress(5, "validating frozen project scope");
    const scope = await dependencies.validateFrozenScope(configuration);
    await assertNotCancelled(ctx);

    await checkpoint({ stage: "SOURCE_PROCESSING", readyForRates: false });
    await ctx.updateProgress(15, "processing drawing sources");
    const processing = await dependencies.ensureSourcesProcessed(actor, configuration);
    if (processing.state === "NEEDS_INPUT") {
      return {
        status: ExtractionJobStatus.NEEDS_INPUT,
        resultSummary: {
          ...summary,
          stage: "SOURCE_INPUT_REQUIRED",
          readyForRates: false,
          exceptions: processing.exceptions,
        },
      };
    }
    await assertNotCancelled(ctx);

    const savedProviderResult = record(summary.providerResult);
    const staleEmptyProviderResult = Boolean(
      summary.providerResult
      && summary.measuredSubjectCount === 0
      && summary.addedItemCount === 0
      && (
        processing.evidenceChanged
        || savedProviderResult.reasonerContractVersion !== AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION
      )
    );
    if (staleEmptyProviderResult) {
      await checkpoint({
        providerAttempt: null,
        providerResult: null,
        providerFailure: null,
        staleEmptyProviderResultDiscardedAt: dependencies.now().toISOString(),
      });
    }

    await checkpoint({ stage: "CATEGORIZING", readyForRates: false });
    await ctx.updateProgress(45, "measuring and reconciling drawing evidence");
    const execution = resolveAutonomousProviderExecution(summary);
    const measurementInput: PrepareTayqanMeasurementsInput = {
      projectId: configuration.projectId,
      sourceFileIds: configuration.frozenSources.map((source) => source.id),
      targetBoqId: configuration.targetBoqId,
      governingContext: {
        projectCategory: scope.industryContext.name,
        categoryScope: `Selected project industry: ${scope.industryContext.key}`,
        measurementStandard: null,
        exclusions: null,
        deadlineText: null,
        specialInstructions: null,
        pricingBasis: "Unpriced BOQ; user supplies unit rates only.",
        authoritativeSourcePolicy: "Frozen source IDs, checksums and revisions are authoritative for this operation.",
        industryPolicy: scope.industryContext,
      },
    };
    const measurementOptions: PrepareTayqanMeasurementsOptions = {
      completionAuditOperationId: configuration.operationHash,
      persistencePolicy: {
        mode: "SYSTEM_VALIDATED",
        calculatedByPrefix: `UNIVERSAL:autonomous-boq/v1:${configuration.operationHash}:`,
        measurementVersion: "autonomous-boq/v1",
        measurementAuditAction: "AUTONOMOUS_MEASUREMENT_SYSTEM_VALIDATED",
        completionAuditAction: "AUTONOMOUS_MEASUREMENT_PASS_COMPLETED",
        actorName: "Quantara Autonomous Measurement",
      },
      onProgress: async (progress) => {
        const completed = Math.max(0, progress.completed);
        const total = Math.max(1, progress.total);
        await ctx.updateProgress(45 + Math.min(35, Math.round((completed / total) * 35)), "measuring drawing clusters");
      },
      onEvidencePrepared: () => checkpoint({ stage: "MEASURING", readyForRates: false }),
    };
    if (execution.kind === "REPLAY_RESULT") {
      measurementOptions.replayReasonerResult = execution.result;
    } else {
      measurementOptions.onReasonerStart = () => checkpoint({
        providerAttempt: {
          operationHash: configuration.operationHash,
          startedAt: dependencies.now().toISOString(),
        },
      });
      measurementOptions.onReasonerResult = (result: TayqanMeasurementReasonerResult) => checkpoint({
        providerResult: {
          operationHash: configuration.operationHash,
          checkpointedAt: dependencies.now().toISOString(),
          reasonerContractVersion: AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION,
          value: result,
        },
      });
    }

    let measurement: PrepareTayqanMeasurementsResult;
    try {
      measurement = await dependencies.measure(
        actor,
        scope.projectSlug,
        measurementInput,
        measurementOptions,
      );
    } catch (error) {
      if (summary.providerAttempt && !summary.providerResult) {
        const appError = error instanceof AppError
          ? error
          : new AppError(
            "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED",
            "TAYQAN could not complete the bounded AI measurement pass.",
            503,
          );
        await checkpoint({
          providerFailure: {
            operationHash: configuration.operationHash,
            failedAt: dependencies.now().toISOString(),
            code: appError.code,
            message: appError.message.slice(0, 500),
            status: appError.status,
            ...("providerDiagnostic" in appError
              ? { providerDiagnostic: appError.providerDiagnostic }
              : {}),
          },
        });
        throw appError;
      }
      throw error;
    }
    await assertNotCancelled(ctx);

    await checkpoint({ stage: "ASSEMBLING_BOQ", readyForRates: false });
    await ctx.updateProgress(85, "assembling unpriced BOQ");
    const assembly = await dependencies.assemble(actor, configuration, scope, measurement);
    const classifications = measurement.classifications ?? [];
    const classificationsByPageId = new Map(classifications.map((classification) => [classification.pageId, classification] as const));
    const measurementExceptions: PreparationException[] = measurement.exceptions.map((exception) => {
      const related = (exception.pageIds ?? []).flatMap((pageId) => classificationsByPageId.get(pageId) ?? []);
      const category = related.flatMap((classification) => classification.categoryPaths)[0];
      return {
        code: exception.kind,
        message: exception.message,
        sourceFileIds: configuration.frozenSources.map((source) => source.id),
        pageIds: exception.pageIds,
        sourceSheets: related.map((classification) => classification.drawingNumber || classification.sheetNumber || `Page ${classification.pageNumber}`),
        projectRevision: related.map((classification) => classification.revision).find(Boolean) ?? null,
        discipline: category?.discipline ?? null,
        workPackage: category?.workPackage ?? null,
      };
    });
    const exceptions = consolidatePreparationFindings([...measurementExceptions, ...assembly.exceptions]);
    const conceptClassifications = classifications.filter((classification) => classification.maturity === "CONCEPT_BASIS_OF_DESIGN");
    const payableEligibility = conceptClassifications.length > 0 ? "NOT_PAYABLE_CONCEPT" : "PAYABLE_ELIGIBLE";
    if (conceptClassifications.length > 0 && !exceptions.some((exception) => exception.code === "CONCEPT_DRAWING_NOT_PAYABLE")) {
      exceptions.push(...consolidatePreparationFindings([{
        code: "CONCEPT_DRAWING_NOT_PAYABLE",
        message: "NOT FOR CONSTRUCTION concept drawings cannot support a payable BOQ.",
        sourceFileIds: [...new Set(conceptClassifications.map((classification) => classification.projectFileId))],
        pageIds: conceptClassifications.map((classification) => classification.pageId),
        sourceSheets: conceptClassifications.map((classification) => classification.drawingNumber || classification.sheetNumber || `Page ${classification.pageNumber}`),
      }]));
    }
    const ready = assembly.state === "READY_FOR_RATES" && exceptions.length === 0 && payableEligibility === "PAYABLE_ELIGIBLE";

    return {
      status: ready ? ExtractionJobStatus.COMPLETED : ExtractionJobStatus.NEEDS_REVIEW,
      resultSummary: {
        ...summary,
        stage: ready ? "READY_FOR_RATES" : "NEEDS_REVIEW",
        readyForRates: ready,
        boqId: assembly.boqId,
        addedItemCount: assembly.addedItemCount,
        duplicateItemCount: assembly.duplicateItemCount,
        measuredSubjectCount: measurement.measuredSubjectCount,
        provider: measurement.provider,
        model: measurement.model,
        exceptions,
        drawingMaturity: [...new Set(classifications.map((classification) => classification.maturity))],
        payableEligibility,
        categoryStatus: classifications.some((classification) => classification.status === "VERIFIED") ? "VERIFIED" : "REVIEW_REQUIRED",
        conceptSchedule: measurement.conceptSchedule,
      },
      usageMetadata: {
        provider: measurement.provider,
        model: measurement.model,
        providerCallReplayed: execution.kind === "REPLAY_RESULT",
      },
    };
  };
}

export const autonomousBoqPreparationHandler = createAutonomousBoqPreparationHandler();

extractionJobQueue.registerHandler(
  ExtractionEngineType.QUANTITY_CALCULATION,
  autonomousBoqPreparationHandler,
);
