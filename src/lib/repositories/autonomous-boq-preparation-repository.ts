import {
  ExtractionEngineType,
  ExtractionJobStatus,
  Prisma,
  type ExtractionJob,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  authorizePreviewProviderKeyRecovery,
  authorizeSingle429ProviderRecovery,
  autonomousPreparationConfigurationSchema,
  isPreviewProviderKeyRecoveryEligible,
  PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON,
  type AutonomousPreparationConfiguration,
} from "@/lib/autonomous-boq/preparation";
import { verifyOpenAIProviderProject } from "@/lib/tayqan/openai-tayqan-measurement-reasoner";

function jsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export type CreateAutonomousPreparationJobInput = {
  configuration: AutonomousPreparationConfiguration;
  anchorProjectFileId: string;
  createdByUserId: string;
  maximumAttempts?: number;
};

export async function findOrCreateAutonomousPreparationJob(
  input: CreateAutonomousPreparationJobInput,
): Promise<{ job: ExtractionJob; created: boolean }> {
  const configuration = autonomousPreparationConfigurationSchema.parse(
    input.configuration,
  );

  return prisma.$transaction(async (tx) => {
    const lockedProject = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Project"
      WHERE "id" = ${configuration.projectId}::uuid
        AND "companyId" = ${configuration.companyId}::uuid
      FOR UPDATE
    `);
    if (lockedProject.length !== 1) throw new NotFoundError("Project not found.");

    const [targetBoq, creator, files] = await Promise.all([
      tx.bOQ.findFirst({
        where: {
          id: configuration.targetBoqId,
          companyId: configuration.companyId,
          projectId: configuration.projectId,
        },
        select: { id: true },
      }),
      tx.user.findFirst({
        where: {
          id: input.createdByUserId,
          companyId: configuration.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      tx.projectFile.findMany({
        where: {
          companyId: configuration.companyId,
          projectId: configuration.projectId,
          id: { in: configuration.frozenSources.map((source) => source.id) },
          status: { not: "ARCHIVED" },
        },
        select: { id: true, checksum: true, revisionNumber: true },
      }),
    ]);

    if (!targetBoq) {
      throw new AppError(
        "AUTONOMOUS_TARGET_BOQ_SCOPE_INVALID",
        "The target BOQ does not belong to this project and company.",
        403,
      );
    }
    if (!creator) {
      throw new AppError(
        "AUTONOMOUS_PREPARATION_ACTOR_INVALID",
        "The user starting this preparation is no longer an active member of the company.",
        403,
      );
    }
    if (files.length !== configuration.frozenSources.length) {
      throw new AppError(
        "AUTONOMOUS_SOURCE_SCOPE_INVALID",
        "One or more frozen sources are missing, archived, or outside this project.",
        409,
      );
    }

    const expectedById = new Map(
      configuration.frozenSources.map((source) => [source.id, source] as const),
    );
    const changed = files.some((file) => {
      const expected = expectedById.get(file.id);
      return !expected
        || expected.checksum.toLowerCase() !== file.checksum.toLowerCase()
        || expected.revision !== (file.revisionNumber?.trim() || null);
    });
    if (changed) {
      throw new ConflictError(
        "AUTONOMOUS_SOURCE_SCOPE_CHANGED",
        "A source checksum or revision changed after the preparation scope was frozen.",
      );
    }

    const anchor = expectedById.get(input.anchorProjectFileId);
    if (!anchor) {
      throw new AppError(
        "AUTONOMOUS_ANCHOR_OUTSIDE_SCOPE",
        "The preparation anchor file is outside the frozen source scope.",
        409,
      );
    }

    const existing = await tx.extractionJob.findFirst({
      where: {
        companyId: configuration.companyId,
        projectId: configuration.projectId,
        engineType: ExtractionEngineType.QUANTITY_CALCULATION,
        configurationJson: {
          path: ["operationHash"],
          equals: configuration.operationHash,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { job: existing, created: false };

    const job = await tx.extractionJob.create({
      data: {
        companyId: configuration.companyId,
        projectId: configuration.projectId,
        projectFileId: input.anchorProjectFileId,
        engineType: ExtractionEngineType.QUANTITY_CALCULATION,
        status: ExtractionJobStatus.QUEUED,
        currentStep: "SOURCE_VALIDATION",
        createdByUserId: input.createdByUserId,
        maximumAttempts: input.maximumAttempts ?? 3,
        configurationJson: configuration as unknown as Prisma.InputJsonValue,
      },
    });
    await createAuditLog(configuration.companyId, {
      entityType: "ExtractionJob",
      entityId: job.id,
      action: "AUTONOMOUS_BOQ_PREPARATION_QUEUED",
      payload: {
        operationHash: configuration.operationHash,
        projectId: configuration.projectId,
        targetBoqId: configuration.targetBoqId,
        industryKey: configuration.industry.key,
        sourceFileIds: configuration.frozenSources.map((source) => source.id),
      },
    }, tx);
    return { job, created: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getAutonomousPreparationJob(
  companyId: string,
  jobId: string,
): Promise<ExtractionJob> {
  const job = await prisma.extractionJob.findFirst({
    where: {
      id: jobId,
      companyId,
      engineType: ExtractionEngineType.QUANTITY_CALCULATION,
    },
  });
  if (!job) throw new NotFoundError("BOQ preparation not found.");
  autonomousPreparationConfigurationSchema.parse(job.configurationJson);
  return job;
}

export async function getLatestAutonomousPreparationJob(
  companyId: string,
  projectId: string,
): Promise<ExtractionJob | null> {
  const candidates = await prisma.extractionJob.findMany({
    where: {
      companyId,
      projectId,
      engineType: ExtractionEngineType.QUANTITY_CALCULATION,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return candidates.find((job) =>
    autonomousPreparationConfigurationSchema.safeParse(job.configurationJson).success
  ) ?? null;
}

/** Merge one durable checkpoint while the claimed run is still active. */
export async function checkpointAutonomousPreparationJob(
  companyId: string,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<ExtractionJob> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ExtractionJob"
      WHERE "id" = ${jobId}::uuid
        AND "companyId" = ${companyId}::uuid
        AND "engineType" = 'QUANTITY_CALCULATION'::"ExtractionEngineType"
      FOR UPDATE
    `);
    if (rows.length !== 1) throw new NotFoundError("BOQ preparation not found.");

    const current = await tx.extractionJob.findFirst({
      where: { id: jobId, companyId },
    });
    if (!current) throw new NotFoundError("BOQ preparation not found.");
    if (current.status !== ExtractionJobStatus.RUNNING) {
      throw new ConflictError(
        "AUTONOMOUS_PREPARATION_NOT_RUNNING",
        "Only the active preparation lease may write a durable checkpoint.",
      );
    }

    const merged = { ...jsonRecord(current.resultSummaryJson), ...patch };
    const updated = await tx.extractionJob.updateMany({
      where: {
        id: jobId,
        companyId,
        status: ExtractionJobStatus.RUNNING,
      },
      data: { resultSummaryJson: merged as Prisma.InputJsonValue },
    });
    if (updated.count !== 1) {
      throw new ConflictError(
        "AUTONOMOUS_PREPARATION_CHECKPOINT_CONFLICT",
        "The preparation lease changed before its checkpoint was saved.",
      );
    }
    return tx.extractionJob.findFirstOrThrow({ where: { id: jobId, companyId } });
  });
}

export async function requeueAutonomousPreparationJob(
  companyId: string,
  jobId: string,
): Promise<ExtractionJob> {
  const current = await getAutonomousPreparationJob(companyId, jobId);
  if (
    current.status !== ExtractionJobStatus.FAILED
    && current.status !== ExtractionJobStatus.NEEDS_INPUT
    && current.status !== ExtractionJobStatus.NEEDS_REVIEW
  ) {
    throw new ConflictError(
      "AUTONOMOUS_PREPARATION_NOT_RETRYABLE",
      `A ${current.status.toLowerCase()} preparation cannot be retried.`,
    );
  }

  const checkpoint = jsonRecord(current.resultSummaryJson);
  let retryCheckpoint: Record<string, unknown> | null = null;
  if (checkpoint.providerAttempt && !checkpoint.providerResult) {
    const authorizedAt = new Date().toISOString();
    if (isPreviewProviderKeyRecoveryEligible(checkpoint)) {
      if (
        process.env.VERCEL_ENV !== "preview"
        || process.env.VERCEL_GIT_COMMIT_REF !== "fix/universal-drawing-to-boq-workflow"
      ) {
        throw new AppError(
          "AUTONOMOUS_PREVIEW_PROVIDER_KEY_RECOVERY_SCOPE_INVALID",
          "The job-specific provider-key recovery is restricted to the authorized feature Preview.",
          409,
        );
      }
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new AppError(
          "TAYQAN_PREVIEW_PROVIDER_KEY_NOT_CONFIGURED",
          "The branch Preview provider key is not configured. No recovery authorization was consumed.",
          503,
        );
      }
      const proof = await verifyOpenAIProviderProject({
        apiKey,
        model: process.env.TAYQAN_MEASUREMENT_MODEL?.trim() || "gpt-5.6-sol",
        expectedProjectPrefix: "proj_qnek",
      });
      retryCheckpoint = authorizePreviewProviderKeyRecovery(checkpoint, {
        jobId,
        authorizedAt,
        providerProjectId: proof.projectId,
        providerRequestId: proof.requestId,
      });
    } else {
      retryCheckpoint = authorizeSingle429ProviderRecovery(checkpoint, authorizedAt);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.extractionJob.updateMany({
      where: {
        id: jobId,
        companyId,
        engineType: ExtractionEngineType.QUANTITY_CALCULATION,
        status: {
          in: [
            ExtractionJobStatus.FAILED,
            ExtractionJobStatus.NEEDS_INPUT,
            ExtractionJobStatus.NEEDS_REVIEW,
          ],
        },
      },
      data: {
        status: ExtractionJobStatus.QUEUED,
        attempts: 0,
        failedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        currentStep: "RETRY_QUEUED",
        ...(retryCheckpoint
          ? { resultSummaryJson: retryCheckpoint as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictError(
        "AUTONOMOUS_PREPARATION_RETRY_CONFLICT",
        "The preparation changed while the retry was requested.",
      );
    }
    if (retryCheckpoint) {
      const recovery = jsonRecord(retryCheckpoint.providerRecovery as Prisma.JsonValue);
      const previewRecovery = jsonRecord(
        retryCheckpoint.previewProviderKeyRecovery as Prisma.JsonValue,
      );
      await createAuditLog(companyId, {
        entityType: "ExtractionJob",
        entityId: jobId,
        action: previewRecovery.reason === PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON
          ? "AUTONOMOUS_PREVIEW_PROVIDER_KEY_RECOVERY_CONSUMED"
          : recovery.reason === "PRE_PROVIDER_INFRASTRUCTURE_RETRY"
          ? "AUTONOMOUS_PRE_PROVIDER_INFRASTRUCTURE_RECOVERY_AUTHORIZED"
          : recovery.reason === "FUNDED_PROJECT_KEY_RETRY"
            ? "AUTONOMOUS_FUNDED_PROJECT_KEY_RECOVERY_AUTHORIZED"
            : "AUTONOMOUS_PROVIDER_429_RECOVERY_AUTHORIZED",
        payload: previewRecovery.reason === PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON
          ? {
              reason: PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON,
              providerProjectId: previewRecovery.providerProjectId as string,
              providerRequestId: previewRecovery.providerRequestId as string | null,
              consumedAt: previewRecovery.consumedAt as string,
            }
          : { attemptCount: recovery.attemptCount as number },
      }, tx);
    }
    return tx.extractionJob.findFirstOrThrow({ where: { id: jobId, companyId } });
  });
}
