import { createHash } from "node:crypto";
import {
  ExtractedEntityStatus,
  ExtractionMethod,
  Prisma,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  AutonomousMeasurementPolicyBindingError,
  resolveAutonomousMeasurementPolicyRule,
} from "@/lib/autonomous-boq/measurement-policy";
import {
  AutonomousCategorizationBindingError,
  categorizeDrawingSheets,
  requireMeasurementCategoryBinding,
  type ControlledCategoryPath,
  type DrawingSheetClassification,
} from "@/lib/autonomous-boq/drawing-categorizer";
import { buildPreliminaryConceptSchedule, type PreliminaryConceptSchedule } from "@/lib/autonomous-boq/concept-schedule";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import {
  evaluateTayqanMeasurementSubject,
  TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
  TAYQAN_MEASUREMENT_VERSION,
  TayqanRevisionConflictError,
  type EvaluatedTayqanMeasurement,
  type TayqanMeasurementException,
} from "@/lib/tayqan/tayqan-measurement-contract";
import { createOpenAITayqanMeasurementReasoner } from "@/lib/tayqan/openai-tayqan-measurement-reasoner";
import { createDeterministicMeasurementReasoner } from "@/lib/autonomous-boq/deterministic-measurement-reasoner";
import {
  classifyTayqanDrawingPageRole,
  mergeTayqanMeasurementPlans,
  type TayqanMeasurementEvidenceBundle,
  type TayqanMeasurementGoverningContext,
  type TayqanMeasurementPageEvidence,
  type TayqanMeasurementReasoner,
  type TayqanMeasurementReasonerProgress,
  type TayqanMeasurementReasonerResult,
  type TayqanSeniorReviewSummary,
  tayqanMeasurementReasonerResultSchema,
} from "@/lib/tayqan/tayqan-measurement-reasoner";
import type { PageTextExtraction } from "@/lib/files/pdf-text-extraction";

const MAX_PAGE_IMAGE_BYTES = 20 * 1024 * 1024;
const ACTIVE_ENTITY_STATUSES = [
  ExtractedEntityStatus.EXTRACTED,
  ExtractedEntityStatus.NEEDS_REVIEW,
  ExtractedEntityStatus.CONFIRMED,
  ExtractedEntityStatus.CORRECTED,
] as const;

export type MeasurementPersistencePolicyInput = {
  mode: "SYSTEM_VALIDATED";
  calculatedByPrefix: string;
  measurementVersion: string;
  measurementAuditAction: string;
  completionAuditAction: string;
  actorName: string;
};

export type ResolvedMeasurementPersistencePolicy = {
  status: ExtractedEntityStatus;
  confirmedAt: Date | null;
  confirmedByUserId: null;
  calculatedByPrefix: string;
  measurementVersion: string;
  measurementAuditAction: string;
  completionAuditAction: string;
  actorName: string | null;
  systemValidated: boolean;
};

/**
 * Keeps TAYQAN's existing proposal/review semantics as the default while
 * allowing the ordinary Quantara workflow to persist a distinct, truthful
 * system-validated calculation. A system prefix must include the immutable
 * 64-character operation hash so two source/policy snapshots can never share
 * a calculatedBy identity.
 */
export function resolveMeasurementPersistencePolicy(
  input?: MeasurementPersistencePolicyInput,
): ResolvedMeasurementPersistencePolicy {
  if (!input) {
    return {
      status: ExtractedEntityStatus.EXTRACTED,
      confirmedAt: null,
      confirmedByUserId: null,
      calculatedByPrefix: TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
      measurementVersion: TAYQAN_MEASUREMENT_VERSION,
      measurementAuditAction: "TAYQAN_MEASUREMENT_PROPOSED",
      completionAuditAction: "TAYQAN_MEASUREMENT_PASS_COMPLETED",
      actorName: null,
      systemValidated: false,
    };
  }

  if (!/:[a-f0-9]{64}:$/i.test(input.calculatedByPrefix)) {
    throw new AppError(
      "AUTONOMOUS_MEASUREMENT_IDENTITY_INVALID",
      "System-validated measurement persistence requires an operation-bound calculation prefix.",
      409,
    );
  }

  return {
    status: ExtractedEntityStatus.CONFIRMED,
    confirmedAt: new Date(),
    confirmedByUserId: null,
    calculatedByPrefix: input.calculatedByPrefix,
    measurementVersion: input.measurementVersion,
    measurementAuditAction: input.measurementAuditAction,
    completionAuditAction: input.completionAuditAction,
    actorName: input.actorName,
    systemValidated: true,
  };
}

let storageAdapter: DocumentStorageAdapter | null = null;
function getStorageAdapter(): DocumentStorageAdapter {
  if (!storageAdapter) {
    storageAdapter = createStorageAdapter({
      provider: resolveStorageProvider(),
      purpose: "project-files",
    });
  }
  return storageAdapter;
}

function jsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizedLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function fingerprintMeasurement(evaluated: EvaluatedTayqanMeasurement): string {
  return createHash("sha256")
    .update(JSON.stringify({
      version: TAYQAN_MEASUREMENT_VERSION,
      existingEntityId: evaluated.subject.existingEntityId,
      primaryPageId: evaluated.subject.primaryPageId,
      evidencePageIds: [...evaluated.subject.evidencePageIds].sort(),
      entityType: evaluated.subject.entityType,
      workPackage: normalizedLabel(evaluated.subject.workPackage),
      location: evaluated.subject.location ? normalizedLabel(evaluated.subject.location) : null,
      label: normalizedLabel(evaluated.subject.label),
      measurementMethod: evaluated.subject.measurementMethod,
      calculationType: evaluated.subject.calculationType,
      inputValues: evaluated.normalizedInputValues,
      supportingChecks: evaluated.supportingChecks.map((check) => ({
        application: check.application,
        measurementMethod: check.measurementMethod,
        calculationType: check.calculationType,
        resultValue: check.resultValue,
        resultUnit: check.resultUnit,
      })),
      formula: evaluated.formula,
      resultValue: evaluated.resultValue,
      resultUnit: evaluated.resultUnit,
    }))
    .digest("hex")
    .slice(0, 24);
}

function sourceText(page: { textLayerJson: Prisma.JsonValue | null }): PageTextExtraction | null {
  const value = page.textLayerJson;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as PageTextExtraction;
}

export type PrepareTayqanMeasurementsInput = {
  projectId: string;
  sourceFileIds: readonly string[];
  governingContext?: TayqanMeasurementGoverningContext | null;
  /**
   * PR2 gap 2: set only for an UPDATE_EXISTING_BOQ assignment (the caller in
   * tayqan-work-order-service.ts decides this — this service stays
   * deliverable-agnostic). When present, the target BOQ's current items are
   * fed into the reasoner's evidence bundle before it proposes new
   * measurements, in addition to (never instead of) the existing post-hoc
   * dedup in ai-draft-boq-service.ts.
   */
  targetBoqId?: string | null;
};

export type PrepareTayqanMeasurementsResult = {
  measuredSubjectCount: number;
  createdEntityCount: number;
  reusedEntityCount: number;
  createdCalculationCount: number;
  reusedCalculationCount: number;
  exceptionCount: number;
  exceptions: TayqanMeasurementException[];
  provider: string;
  model: string;
  seniorReview: TayqanSeniorReviewSummary;
  classifications?: DrawingSheetClassification[];
  conceptSchedule?: PreliminaryConceptSchedule | null;
};

export type PrepareTayqanMeasurementsOptions = {
  reasoner?: TayqanMeasurementReasoner;
  env?: NodeJS.ProcessEnv;
  /** Used by the persisted TAYQAN work order to keep its execution lease fresh. */
  onProgress?: (progress: TayqanMeasurementReasonerProgress) => Promise<void>;
  /** Optional durable checkpoint after categorization/evidence preparation and before AI measurement. */
  onEvidencePrepared?: () => Promise<void>;
  /**
   * A validated, durably checkpointed provider result. When supplied the paid
   * reasoner is never constructed or invoked; only deterministic validation
   * and idempotent local persistence are replayed.
   */
  replayReasonerResult?: TayqanMeasurementReasonerResult;
  /**
   * Persists the operation-bound provider-attempt boundary immediately before
   * a fresh reasoner invocation. If this callback does not complete, the
   * reasoner is never called.
   */
  onReasonerStart?: () => Promise<void>;
  /**
   * Called exactly once after a fresh reasoner success and before any
   * proposal validation, measurement write, or completion audit.
   */
  onReasonerResult?: (result: TayqanMeasurementReasonerResult) => Promise<void>;
  /** Stable work-order operation id used to deduplicate completion audit replay. */
  completionAuditOperationId?: string;
  /**
   * Omitted by every existing TAYQAN caller. The universal workflow supplies
   * this only after evidence, deterministic formula and senior-review gates
   * pass, so the persisted calculation is system validated without claiming
   * a human confirmed it.
   */
  persistencePolicy?: MeasurementPersistencePolicyInput;
};

async function buildEvidenceBundle(
  actor: CurrentActor,
  projectIdentifier: string,
  input: PrepareTayqanMeasurementsInput,
): Promise<{
  bundle: TayqanMeasurementEvidenceBundle;
  imageStorageKeyByPageId: Map<string, string>;
}> {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  if (project.id !== input.projectId) {
    throw new AppError(
      "TAYQAN_MEASUREMENT_PROJECT_MISMATCH",
      "TAYQAN measurement input belongs to another project.",
      403,
    );
  }

  const sourceFileIds = [...new Set(input.sourceFileIds.map((id) => id.trim()).filter(Boolean))];
  if (sourceFileIds.length === 0) {
    throw new AppError(
      "TAYQAN_MEASUREMENT_SOURCES_REQUIRED",
      "TAYQAN needs the frozen source-file scope before measuring the drawings.",
      409,
    );
  }

  const files = await prisma.projectFile.findMany({
    where: {
      companyId: actor.companyId,
      projectId: project.id,
      id: { in: sourceFileIds },
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      originalName: true,
      drawingNumber: true,
      drawingTitle: true,
      revisionNumber: true,
      scaleText: true,
      metadataJson: true,
    },
  });
  if (files.length !== sourceFileIds.length) {
    throw new AppError(
      "TAYQAN_MEASUREMENT_SOURCE_SCOPE_INVALID",
      "One or more frozen TAYQAN source files are missing, archived, or outside this project.",
      409,
    );
  }

  const fileById = new Map(files.map((file) => [file.id, file]));
  const pages = await prisma.drawingPage.findMany({
    where: {
      companyId: actor.companyId,
      projectFileId: { in: sourceFileIds },
    },
    orderBy: [{ projectFileId: "asc" }, { pageNumber: "asc" }],
  });

  if (pages.length === 0) {
    throw new AppError(
      "TAYQAN_MEASUREMENT_PAGES_REQUIRED",
      "TAYQAN cannot measure these sources because no processed drawing pages exist yet.",
      409,
    );
  }

  const calibrations = await prisma.drawingScaleCalibration.findMany({
    where: {
      companyId: actor.companyId,
      drawingPageId: { in: pages.map((page) => page.id) },
    },
    orderBy: { createdAt: "desc" },
  });
  const calibrationByPageId = new Map<string, (typeof calibrations)[number]>();
  const calibrationById = new Map(calibrations.map((calibration) => [calibration.id, calibration] as const));
  for (const calibration of calibrations) {
    if (!calibrationByPageId.has(calibration.drawingPageId)) {
      calibrationByPageId.set(calibration.drawingPageId, calibration);
    }
  }

  let pageEvidence: TayqanMeasurementPageEvidence[] = pages.map((page) => {
    const file = fileById.get(page.projectFileId);
    if (!file) throw new Error("TAYQAN page resolved to a source file outside its frozen scope.");
    const metadata = jsonRecord(file.metadataJson);
    const text = sourceText(page);
    const calibration = calibrationByPageId.get(page.id) ?? null;
    const discipline = typeof metadata.discipline === "string" ? metadata.discipline : null;
    const drawingType = typeof metadata.drawingType === "string" ? metadata.drawingType : null;
    const drawingTitles = text?.signals?.drawingTitles ?? [];

    return {
      id: page.id,
      projectFileId: page.projectFileId,
      originalName: file.originalName,
      pageNumber: page.pageNumber,
      drawingNumber: file.drawingNumber,
      drawingTitle: file.drawingTitle,
      revisionNumber: file.revisionNumber,
      discipline,
      drawingType,
      sheetName: page.sheetName,
      role: classifyTayqanDrawingPageRole({
        drawingType,
        drawingTitle: file.drawingTitle,
        sheetName: page.sheetName,
        drawingTitles,
        discipline,
      }),
      width: page.width,
      height: page.height,
      dpi: page.dpi,
      text: text?.text ?? null,
      drawingTitles,
      technicalLines: text?.signals?.technicalLines ?? [],
      detectedScale: page.detectedScale ?? file.scaleText,
      scaleVerified: calibration?.isVerified === true,
      scaleRatio: calibration?.scaleRatio.toNumber() ?? null,
      drawingUnit: calibration?.drawingUnit ?? null,
      realWorldUnit: calibration?.realWorldUnit ?? null,
      hasImage: Boolean(page.imageStorageKey),
    };
  });

  const industryPolicy = input.governingContext?.industryPolicy;
  if (industryPolicy) {
    const classifications = categorizeDrawingSheets({
      engineId: industryPolicy.engineId,
      pages: pageEvidence,
      rules: industryPolicy.rules,
    });
    const classificationByPageId = new Map(classifications.map((classification) => [classification.pageId, classification] as const));
    await prisma.$transaction(pages.map((page) => prisma.drawingPage.update({
      where: { id: page.id, companyId: actor.companyId },
      data: {
        titleBlockJson: {
          ...(jsonRecord(page.titleBlockJson) ?? {}),
          autonomousClassification: classificationByPageId.get(page.id)!,
        } as Prisma.InputJsonObject,
      },
    })));
    pageEvidence = pageEvidence.map((page) => ({
      ...page,
      classification: classificationByPageId.get(page.id),
    }));
  }

  const entities = await prisma.extractedEntity.findMany({
    where: {
      companyId: actor.companyId,
      projectId: project.id,
      projectFileId: { in: sourceFileIds },
      status: { in: [...ACTIVE_ENTITY_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
  });

  const rooms = await prisma.detectedRoom.findMany({
    where: {
      companyId: actor.companyId,
      projectId: project.id,
      drawingPageId: { in: pages.map((page) => page.id) },
      status: { in: [...ACTIVE_ENTITY_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
  });

  // PR2 gap 2: read once, here, alongside the rest of this frozen-scope
  // bundle — never re-queried mid-pass. Only ever populated for an
  // UPDATE_EXISTING_BOQ assignment; every other assignment gets an empty
  // array, identical to today's behavior.
  if (input.targetBoqId) {
    const targetBoq = await prisma.bOQ.findFirst({
      where: {
        id: input.targetBoqId,
        companyId: actor.companyId,
        projectId: project.id,
      },
      select: { id: true },
    });
    if (!targetBoq) {
      throw new AppError(
        "TAYQAN_MEASUREMENT_TARGET_BOQ_SCOPE_INVALID",
        "The target BOQ is outside the frozen measurement project scope.",
        403,
      );
    }
  }

  const existingBoqItems = input.targetBoqId
    ? await prisma.bOQItem.findMany({
        where: { companyId: actor.companyId, section: { boqId: input.targetBoqId } },
        include: { section: { select: { code: true, title: true } } },
        orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      })
    : [];

  return {
    bundle: {
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
        reference: project.reference,
      },
      governingContext: input.governingContext ?? null,
      sourceFileIds,
      pages: pageEvidence,
      existingEntities: entities.map((entity) => ({
        id: entity.id,
        projectFileId: entity.projectFileId,
        drawingPageId: entity.drawingPageId,
        entityType: entity.entityType,
        label: entity.label,
        quantity: entity.quantity?.toNumber() ?? null,
        unit: entity.unit,
        confidence: entity.confidence.toNumber(),
        status: entity.status,
        sourceText: entity.sourceText,
        sourceReference: entity.sourceReference,
        technicalData: entity.technicalDataJson,
        extractionMethod: entity.extractionMethod,
      })),
      existingBoqItems: existingBoqItems.map((item) => ({
        id: item.id,
        sectionCode: item.section.code,
        sectionTitle: item.section.title,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity.toNumber(),
        unit: item.unit,
      })),
      rooms: rooms.map((room) => ({
        id: room.id,
        drawingPageId: room.drawingPageId,
        roomName: room.roomName,
        roomNumber: room.roomNumber,
        area: room.area?.toNumber() ?? null,
        perimeter: room.perimeter?.toNumber() ?? null,
        ceilingHeight: room.ceilingHeight?.toNumber() ?? null,
        floorLevel: room.floorLevel,
        scaleVerified: room.scaleCalibrationId
          ? calibrationById.get(room.scaleCalibrationId)?.isVerified === true
          : false,
        confidence: room.confidence.toNumber(),
        status: room.status,
      })),
    },
    imageStorageKeyByPageId: new Map(
      pages.flatMap((page) => page.imageStorageKey ? [[page.id, page.imageStorageKey] as const] : []),
    ),
  };
}

type CategorizedMeasurement = EvaluatedTayqanMeasurement & { categoryPath?: ControlledCategoryPath };

async function resolveOrCreateMeasurementEntity(
  db: Prisma.TransactionClient,
  actor: CurrentActor,
  projectId: string,
  evaluated: CategorizedMeasurement,
  pageById: ReadonlyMap<string, { projectFileId: string; originalName: string }>,
  fingerprint: string,
) {
  if (evaluated.subject.existingEntityId) {
    const existing = await db.extractedEntity.findFirst({
      where: {
        id: evaluated.subject.existingEntityId,
        companyId: actor.companyId,
        projectId,
        status: { in: [...ACTIVE_ENTITY_STATUSES] },
      },
    });
    if (!existing) {
      throw new AppError(
        "TAYQAN_MEASUREMENT_ENTITY_CHANGED",
        "An extracted entity changed while TAYQAN was preparing measurements. Restart the work order against the current evidence.",
        409,
      );
    }
    if (evaluated.categoryPath) {
      return {
        entity: await db.extractedEntity.update({
          where: { id: existing.id, companyId: actor.companyId },
          data: { technicalDataJson: { ...(jsonRecord(existing.technicalDataJson) ?? {}), categoryPath: evaluated.categoryPath } as Prisma.InputJsonObject },
        }),
        created: false,
      };
    }
    return { entity: existing, created: false };
  }

  const primaryPage = pageById.get(evaluated.subject.primaryPageId);
  if (!primaryPage) {
    throw new Error("TAYQAN measurement primary page has no source file.");
  }
  const primaryProjectFileId = primaryPage.projectFileId;
  const marker = `TAYQAN_MEASUREMENT:${fingerprint}`;
  const existing = await db.extractedEntity.findFirst({
    where: {
      companyId: actor.companyId,
      projectId,
      projectFileId: primaryProjectFileId,
      drawingPageId: evaluated.subject.primaryPageId,
      extractionMethod: ExtractionMethod.VISION_MODEL,
      sourceReference: { contains: marker },
    },
  });
  if (existing) {
    if (evaluated.categoryPath) {
      return {
        entity: await db.extractedEntity.update({
          where: { id: existing.id, companyId: actor.companyId },
          data: { technicalDataJson: { ...(jsonRecord(existing.technicalDataJson) ?? {}), categoryPath: evaluated.categoryPath } as Prisma.InputJsonObject },
        }),
        created: false,
      };
    }
    return { entity: existing, created: false };
  }

  const entity = await db.extractedEntity.create({
    data: {
      companyId: actor.companyId,
      projectId,
      projectFileId: primaryProjectFileId,
      drawingPageId: evaluated.subject.primaryPageId,
      entityType: evaluated.subject.entityType,
      label: evaluated.subject.label,
      normalizedLabel: normalizedLabel(evaluated.subject.label),
      quantity: null,
      unit: null,
      confidence: evaluated.confidence,
      extractionMethod: ExtractionMethod.VISION_MODEL,
      sourceText: evaluated.subject.sourceSummary,
      sourceReference: `${primaryPage.originalName} · ${marker}`,
      technicalDataJson: {
        tayqanMeasurementVersion: TAYQAN_MEASUREMENT_VERSION,
        measurementFingerprint: fingerprint,
        evidencePageIds: evaluated.subject.evidencePageIds,
        workPackage: evaluated.subject.workPackage,
        location: evaluated.subject.location,
        measurementMethod: evaluated.subject.measurementMethod,
        methodSelectionRationale: evaluated.subject.methodSelectionRationale,
        methodConfidence: evaluated.subject.methodConfidence,
        calculationType: evaluated.subject.calculationType,
        evidenceInputs: evaluated.subject.inputs,
        supportingChecks: evaluated.supportingChecks,
        rationale: evaluated.subject.rationale,
        sourceSummary: evaluated.subject.sourceSummary,
        categoryPath: evaluated.categoryPath ?? null,
      },
      status: ExtractedEntityStatus.NEEDS_REVIEW,
    },
  });
  return { entity, created: true };
}

async function runTayqanMeasurementPhase<T>(
  phase: string,
  code: string,
  customerMessage: string,
  execute: () => Promise<T>,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[TAYQAN-MEASUREMENT] ${phase} failed`, error);
    throw new AppError(code, customerMessage, 503);
  }
}

export async function prepareTayqanMeasurementProposals(
  actor: CurrentActor,
  projectIdentifier: string,
  input: PrepareTayqanMeasurementsInput,
  options: PrepareTayqanMeasurementsOptions = {},
): Promise<PrepareTayqanMeasurementsResult> {
  requireCapability(actor, "boq:edit");
  const persistencePolicy = resolveMeasurementPersistencePolicy(
    options.persistencePolicy,
  );
  const { bundle, imageStorageKeyByPageId } = await runTayqanMeasurementPhase(
    "evidence preparation",
    "TAYQAN_MEASUREMENT_EVIDENCE_PREPARATION_FAILED",
    "TAYQAN could not prepare the processed source evidence for measurement. Retry this same assignment; completed work remains preserved.",
    () => buildEvidenceBundle(actor, projectIdentifier, input),
  );
  await options.onEvidencePrepared?.();

  let result: TayqanMeasurementReasonerResult;
  if (options.replayReasonerResult) {
    const replay = tayqanMeasurementReasonerResultSchema.safeParse(
      options.replayReasonerResult,
    );
    if (!replay.success) {
      throw new AppError(
        "TAYQAN_MEASUREMENT_PROVIDER_RESULT_REPLAY_INVALID",
        "TAYQAN found an invalid preserved measurement result and stopped before making another paid provider request. Contact support to recover this assignment safely.",
        409,
      );
    }
    result = replay.data;
  } else {
    const env = options.env ?? process.env;
    const apiKey = env.OPENAI_API_KEY?.trim();
    const model = env.TAYQAN_MEASUREMENT_MODEL?.trim()
      || "gpt-5.6-sol";
    const safetyIdentifier = `tayqan_${createHash("sha256")
      .update(actor.userId)
      .digest("hex")
      .slice(0, 32)}`;
    const useSeniorProMode = env.TAYQAN_SENIOR_PRO_MODE?.trim() === "1";
    // The commercial estimator is code-driven. Only callers that omit the
    // system-validated persistence policy (paid TAYQAN work orders) may fall
    // through to the OpenAI reasoner.
    const providedReasoner = options.reasoner
      ?? (persistencePolicy.systemValidated
        ? createDeterministicMeasurementReasoner()
        : undefined);
    if (!providedReasoner && !apiKey) {
      throw new AppError(
        "TAYQAN_MEASUREMENT_AI_NOT_CONFIGURED",
        "TAYQAN drawing measurement requires the configured server-side AI provider before it can prepare a quantity-complete draft.",
        503,
      );
    }

    const reasonerResult = await runTayqanMeasurementPhase(
      "AI reasoning",
      "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED",
      "TAYQAN could not complete the bounded AI measurement pass. Retry this same assignment; completed work remains preserved.",
      async () => {
        if (options.onReasonerStart) {
          try {
            await options.onReasonerStart();
          } catch (error) {
            console.error(
              "[TAYQAN-MEASUREMENT] provider attempt checkpoint failed before reasoner invocation",
              error,
            );
            throw new AppError(
              "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_CHECKPOINT_FAILED",
              "TAYQAN could not confirm the durable provider-attempt checkpoint, so it stopped before starting the paid measurement request. Retry only after the assignment state is rechecked.",
              503,
            );
          }
        }

        const reasoner = providedReasoner ?? createOpenAITayqanMeasurementReasoner({
          apiKey: apiKey!,
          model,
          safetyIdentifier,
          useSeniorProMode,
        });
        return reasoner({
          bundle,
          onProgress: options.onProgress,
          loadPageImageDataUrl: async (pageId) => {
            const key = imageStorageKeyByPageId.get(pageId);
            if (!key) return null;
            const buffer = await getStorageAdapter().getObject(key);
            if (buffer.byteLength > MAX_PAGE_IMAGE_BYTES) {
              throw new AppError(
                "TAYQAN_MEASUREMENT_PAGE_TOO_LARGE",
                "A rendered drawing page is too large for bounded AI measurement analysis. Re-render the page at the standard processing resolution instead of sending an unbounded image.",
                409,
              );
            }
            return `data:image/png;base64,${buffer.toString("base64")}`;
          },
        });
      },
    );
    const parsedReasonerResult = tayqanMeasurementReasonerResultSchema.safeParse(
      reasonerResult,
    );
    if (!parsedReasonerResult.success) {
      throw new AppError(
        "TAYQAN_MEASUREMENT_AI_RESPONSE_INVALID",
        "TAYQAN's configured AI provider returned an invalid measurement result. Retry the assignment manually; no result was persisted.",
        503,
      );
    }
    result = parsedReasonerResult.data;

    if (options.onReasonerResult) {
      try {
        await options.onReasonerResult(result);
      } catch (error) {
        console.error(
          "[TAYQAN-MEASUREMENT] provider result checkpoint failed; paid result will not be requested again automatically",
          error,
        );
        throw new AppError(
          "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINT_FAILED",
          "TAYQAN received the measurement result but could not confirm its durable recovery checkpoint. The assignment has stopped to prevent another paid provider request; contact support.",
          503,
        );
      }
    }
  }

  const allowedEntityIds = new Set(bundle.existingEntities.map((entity) => entity.id));
  const roomsById = new Map(
    bundle.rooms.map((room) => [room.id, { scaleVerified: room.scaleVerified }] as const),
  );
  const pagesById = new Map(
    bundle.pages.map((page) => [page.id, {
      projectFileId: page.projectFileId,
      scaleVerified: page.scaleVerified,
      drawingNumber: page.drawingNumber,
      revisionNumber: page.revisionNumber,
      role: page.role,
    }] as const),
  );
  const pageById = new Map(
    bundle.pages.map((page) => [page.id, {
      projectFileId: page.projectFileId,
      originalName: page.originalName,
    }] as const),
  );

  // A reasoner proposal is still untrusted until it passes the deterministic
  // calculator/evidence contract below. One invalid proposal must never crash
  // the entire paid work order or hide behind a generic HTTP 500. Preserve the
  // dedicated revision-conflict signal, and convert every other rejected
  // proposal into a visible, dangerous measurement exception. The work order
  // can therefore continue to the review document, but BOQ acceptance remains
  // blocked until a professional resolves the invalid proposal.
  const evaluated: CategorizedMeasurement[] = [];
  const validationExceptions: TayqanMeasurementException[] = [];
  for (const subject of result.plan.subjects) {
    try {
      const measurement = evaluateTayqanMeasurementSubject(subject, { allowedEntityIds, roomsById, pagesById });
      const industryPolicy = input.governingContext?.industryPolicy;
      if (!industryPolicy) {
        evaluated.push(measurement);
        continue;
      }

      const policyBinding = resolveAutonomousMeasurementPolicyRule({
        workPackage: measurement.subject.workPackage,
        calculationType: measurement.subject.calculationType,
        calculatedResultUnit: measurement.resultUnit,
        allowedRules: industryPolicy.rules.map((rule) => ({
          id: rule.id,
          calculationType: rule.calculationType,
          boqUnit: rule.resultUnit,
        })),
      });
      const categoryPath = requireMeasurementCategoryBinding({
        workPackage: policyBinding.ruleId,
        evidencePageIds: measurement.subject.evidencePageIds,
        classificationsByPageId: new Map(bundle.pages.flatMap((page) => page.classification ? [[page.id, page.classification] as const] : [])),
      });
      evaluated.push({ ...measurement, resultUnit: policyBinding.resultUnit, categoryPath });
    } catch (error) {
      if (error instanceof TayqanRevisionConflictError) {
        validationExceptions.push(error.exception);
        continue;
      }
      if (error instanceof AutonomousMeasurementPolicyBindingError) {
        validationExceptions.push({
          kind: "UNSUPPORTED_FORMULA",
          message: error.message,
          pageIds: [...new Set(subject.evidencePageIds)],
          relatedEntityId: subject.existingEntityId,
        });
        continue;
      }
      if (error instanceof AutonomousCategorizationBindingError) {
        validationExceptions.push({
          kind: "METHOD_SELECTION_UNCERTAIN",
          message: error.message,
          pageIds: [...new Set(subject.evidencePageIds)],
          relatedEntityId: subject.existingEntityId,
        });
        continue;
      }
      validationExceptions.push({
        kind: "METHOD_SELECTION_UNCERTAIN",
        message: "TAYQAN rejected an AI measurement proposal because it did not pass the deterministic measurement and evidence checks. Review the proposed scope and measurement method before acceptance.",
        pageIds: [...new Set(subject.evidencePageIds)],
        relatedEntityId: subject.existingEntityId,
      });
      console.error(
        "[TAYQAN-MEASUREMENT] Rejected invalid reasoner subject",
        error instanceof Error ? error.message : error,
      );
    }
  }
  const exceptions = mergeTayqanMeasurementPlans([
    { subjects: [], exceptions: result.plan.exceptions },
    { subjects: [], exceptions: validationExceptions },
  ]).exceptions;

  let createdEntityCount = 0;
  let reusedEntityCount = 0;
  let createdCalculationCount = 0;
  let reusedCalculationCount = 0;

  for (const measurement of evaluated) {
    const fingerprint = fingerprintMeasurement(measurement);

    const persisted = await runTayqanMeasurementPhase(
      "measurement persistence",
      "TAYQAN_MEASUREMENT_PERSISTENCE_FAILED",
      "TAYQAN could not preserve a validated measurement proposal. Retry this same assignment; completed work remains preserved.",
      () => prisma.$transaction(async (tx) => {
      const { entity, created } = await resolveOrCreateMeasurementEntity(
        tx,
        actor,
        bundle.project.id,
        measurement,
        pageById,
        fingerprint,
      );

      const calculatedBy = `${persistencePolicy.calculatedByPrefix}${fingerprint}`;
      let calculation = await tx.quantityCalculation.findFirst({
        where: {
          companyId: actor.companyId,
          projectId: bundle.project.id,
          extractedEntityId: entity.id,
          calculatedBy,
        },
        orderBy: { createdAt: "desc" },
      });

      let calculationCreated = false;
      if (!calculation) {
        calculation = await tx.quantityCalculation.create({
          data: {
            companyId: actor.companyId,
            projectId: bundle.project.id,
            extractedEntityId: entity.id,
            calculationType: measurement.subject.calculationType,
            inputValuesJson: measurement.normalizedInputValues,
            deductionsJson: measurement.deductions ?? undefined,
            allowancesJson: measurement.allowances ?? undefined,
            formula: measurement.formula,
            resultValue: measurement.resultValue,
            resultUnit: measurement.resultUnit,
            confidence: measurement.confidence,
            status: persistencePolicy.status,
            confirmedAt: persistencePolicy.confirmedAt,
            confirmedByUserId: persistencePolicy.confirmedByUserId,
            calculatedBy,
          },
        });
        calculationCreated = true;

        await createAuditLog(actor.companyId, {
          entityType: "QuantityCalculation",
          entityId: calculation.id,
          action: persistencePolicy.measurementAuditAction,
          actorName: persistencePolicy.actorName ?? actor.fullName,
          payload: {
            projectId: bundle.project.id,
            extractedEntityId: entity.id,
            measurementVersion: persistencePolicy.measurementVersion,
            fingerprint,
            measurementMethod: measurement.subject.measurementMethod,
            methodSelectionRationale: measurement.subject.methodSelectionRationale,
            methodConfidence: measurement.subject.methodConfidence,
            calculationType: measurement.subject.calculationType,
            evidencePageIds: measurement.subject.evidencePageIds,
            evidenceInputs: measurement.subject.inputs,
            workPackage: measurement.subject.workPackage,
            categoryPath: measurement.categoryPath ?? null,
            location: measurement.subject.location,
            normalizedInputValues: measurement.normalizedInputValues,
            formula: measurement.formula,
            baseResultValue: measurement.baseResultValue,
            repetitionMultiplier: measurement.repetitionMultiplier,
            resultValue: measurement.resultValue,
            resultUnit: measurement.resultUnit,
            confidence: measurement.confidence,
            supportingChecks: measurement.supportingChecks,
            rationale: measurement.subject.rationale,
            sourceSummary: measurement.subject.sourceSummary,
            provider: result.provider,
            model: result.model,
            providerResponseIds: result.responseIds,
            seniorReview: result.seniorReview,
            governingContext: bundle.governingContext,
            professionallyConfirmed: false,
            systemValidated: persistencePolicy.systemValidated,
          },
        }, tx);
      }

      if (
        persistencePolicy.systemValidated
        && (
          calculation.status !== ExtractedEntityStatus.CONFIRMED
          || calculation.confirmedAt === null
          || calculation.confirmedByUserId !== null
        )
      ) {
        throw new AppError(
          "AUTONOMOUS_MEASUREMENT_PROVENANCE_INVALID",
          "A preserved autonomous calculation does not carry truthful system-validation provenance.",
          409,
        );
      }

      return { entityCreated: created, calculationCreated };
      }, {
        maxWait: 10_000,
        timeout: 20_000,
      }),
    );

    if (persisted.entityCreated) createdEntityCount += 1;
    else reusedEntityCount += 1;
    if (persisted.calculationCreated) createdCalculationCount += 1;
    else reusedCalculationCount += 1;
  }

  await runTayqanMeasurementPhase(
    "completion audit persistence",
    "TAYQAN_MEASUREMENT_AUDIT_PERSISTENCE_FAILED",
    "TAYQAN completed the measurement pass but could not preserve its completion record. Retry this same assignment; completed work remains preserved.",
    async () => {
      if (options.completionAuditOperationId) {
        const existing = await prisma.auditLog.findFirst({
          where: {
            companyId: actor.companyId,
            entityType: "Project",
            entityId: bundle.project.id,
            action: persistencePolicy.completionAuditAction,
            payloadJson: {
              path: ["operationId"],
              equals: options.completionAuditOperationId,
            },
          },
          select: { id: true },
        });
        if (existing) return existing;
      }

      return createAuditLog(actor.companyId, {
        entityType: "Project",
        entityId: bundle.project.id,
        action: persistencePolicy.completionAuditAction,
        actorName: persistencePolicy.actorName ?? actor.fullName,
        payload: {
          measurementVersion: persistencePolicy.measurementVersion,
          operationId: options.completionAuditOperationId ?? null,
          sourceFileCount: bundle.sourceFileIds.length,
          pageCount: bundle.pages.length,
          measuredSubjectCount: evaluated.length,
          measurementMethodBreakdown: evaluated.reduce<Record<string, number>>((counts, measurement) => {
            counts[measurement.subject.measurementMethod] =
              (counts[measurement.subject.measurementMethod] ?? 0) + 1;
            return counts;
          }, {}),
          supportingCheckCount: evaluated.reduce(
            (total, measurement) => total + measurement.supportingChecks.length,
            0,
          ),
          createdEntityCount,
          reusedEntityCount,
          createdCalculationCount,
          reusedCalculationCount,
          exceptionCount: exceptions.length,
          provider: result.provider,
          model: result.model,
          seniorReview: result.seniorReview,
          governingContext: bundle.governingContext,
          professionallyConfirmed: false,
          systemValidated: persistencePolicy.systemValidated,
        },
      });
    },
  );

  return {
    measuredSubjectCount: evaluated.length,
    createdEntityCount,
    reusedEntityCount,
    createdCalculationCount,
    reusedCalculationCount,
    exceptionCount: exceptions.length,
    exceptions,
    provider: result.provider,
    model: result.model,
    seniorReview: result.seniorReview,
    classifications: bundle.pages.flatMap((page) => page.classification ? [page.classification] : []),
    conceptSchedule: buildPreliminaryConceptSchedule(bundle.pages),
  };
}
