import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import {
  tayqanMeasurementReasonerResultSchema,
  type TayqanMeasurementReasonerResult,
} from "@/lib/tayqan/tayqan-measurement-reasoner";

export const AUTONOMOUS_BOQ_PREPARATION_VERSION =
  "autonomous-boq-preparation-v1" as const;

const frozenSourceSchema = z.object({
  id: z.string().uuid(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  revision: z.string().trim().min(1).max(120).nullable(),
  originalName: z.string().trim().min(1).max(500),
}).strict();

const industrySnapshotSchema = z.object({
  engineId: z.string().uuid(),
  key: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  policyVersion: z.string().trim().min(1).max(120),
  configurationHash: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

const autonomousPreparationConfigurationBaseSchema = z.object({
  contractVersion: z.literal(AUTONOMOUS_BOQ_PREPARATION_VERSION),
  operationHash: z.string().regex(/^[a-f0-9]{64}$/i),
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  targetBoqId: z.string().uuid(),
  industry: industrySnapshotSchema,
  frozenSources: z.array(frozenSourceSchema).min(1).max(500),
}).strict();

export type AutonomousPreparationConfiguration = z.infer<
  typeof autonomousPreparationConfigurationBaseSchema
>;

type OperationIdentityInput = Omit<
  AutonomousPreparationConfiguration,
  "operationHash"
> & { operationHash?: string };

function normalizedIdentity(input: OperationIdentityInput) {
  return {
    contractVersion: input.contractVersion,
    companyId: input.companyId,
    projectId: input.projectId,
    targetBoqId: input.targetBoqId,
    industry: {
      engineId: input.industry.engineId,
      key: input.industry.key,
      name: input.industry.name,
      policyVersion: input.industry.policyVersion,
      configurationHash: input.industry.configurationHash,
    },
    frozenSources: [...input.frozenSources]
      .map((source) => ({
        id: source.id,
        checksum: source.checksum.toLowerCase(),
        revision: source.revision,
        originalName: source.originalName,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

/**
 * Stable identity for one tenant/project/BOQ/industry-policy/source snapshot.
 * Browser retries and refreshes must resolve to this exact operation instead
 * of paying for another provider request or appending duplicate BOQ items.
 */
export function createAutonomousBOQOperationHash(
  input: OperationIdentityInput,
): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizedIdentity(input)))
    .digest("hex");
}

export const autonomousPreparationConfigurationSchema =
  autonomousPreparationConfigurationBaseSchema.superRefine((value, context) => {
    const expected = createAutonomousBOQOperationHash(value);
    if (value.operationHash !== expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operationHash"],
        message:
          "The persisted autonomous BOQ operation hash does not match its frozen source and industry contract.",
      });
    }
  });

const providerAttemptSchema = z.object({
  operationHash: z.string().regex(/^[a-f0-9]{64}$/i),
  startedAt: z.string().datetime(),
}).strict();

const providerResultCheckpointSchema = z.object({
  operationHash: z.string().regex(/^[a-f0-9]{64}$/i),
  checkpointedAt: z.string().datetime(),
  value: tayqanMeasurementReasonerResultSchema,
}).strict();

const providerFailureCheckpointSchema = z.object({
  operationHash: z.string().regex(/^[a-f0-9]{64}$/i),
  failedAt: z.string().datetime(),
  code: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  status: z.number().int().min(400).max(599),
  providerDiagnostic: z.object({
    classification: z.string().trim().min(1).max(80),
    providerCode: z.string().trim().min(1).max(160).nullable(),
    providerType: z.string().trim().min(1).max(160).nullable(),
    httpStatus: z.number().int().min(400).max(599),
    requestId: z.string().trim().min(1).max(160).nullable(),
    organizationId: z.string().trim().min(1).max(160).nullable(),
    projectId: z.string().trim().min(1).max(160).nullable(),
    retryAfter: z.string().trim().min(1).max(160).nullable(),
    requestLimit: z.string().trim().min(1).max(160).nullable(),
    remainingRequests: z.string().trim().min(1).max(160).nullable(),
    requestReset: z.string().trim().min(1).max(160).nullable(),
    tokenLimit: z.string().trim().min(1).max(160).nullable(),
    remainingTokens: z.string().trim().min(1).max(160).nullable(),
    tokenReset: z.string().trim().min(1).max(160).nullable(),
  }).strict().optional(),
}).strict();

const providerRecoverySchema = z.object({
  authorizedAt: z.string().datetime(),
  reason: z.enum([
    "SANITIZED_429_DIAGNOSTIC_RETRY",
    "PRE_PROVIDER_INFRASTRUCTURE_RETRY",
    "FUNDED_PROJECT_KEY_RETRY",
  ]),
  attemptCount: z.number().int().min(1).max(3),
  originalAttempt: providerAttemptSchema.optional(),
  originalFailure: providerFailureCheckpointSchema.optional(),
  infrastructureFailure: providerFailureCheckpointSchema.optional(),
  credentialFailure: providerFailureCheckpointSchema.optional(),
}).strict();

export const PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON =
  "PREVIEW_PROVIDER_KEY_CORRECTED_AFTER_CREDIT_EXHAUSTION" as const;

const previewProviderKeyRecoverySchema = z.object({
  reason: z.literal(PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON),
  jobId: z.string().uuid(),
  authorizedAt: z.string().datetime(),
  consumedAt: z.string().datetime(),
  providerProjectId: z.string().trim().min(1).max(160),
  providerRequestId: z.string().trim().min(1).max(160).nullable(),
}).strict();

export const autonomousPreparationCheckpointSchema = z.object({
  providerAttempt: providerAttemptSchema.nullable().optional(),
  providerResult: providerResultCheckpointSchema.nullable().optional(),
  providerFailure: providerFailureCheckpointSchema.nullable().optional(),
  providerRecovery: providerRecoverySchema.nullable().optional(),
  previewProviderKeyRecovery: previewProviderKeyRecoverySchema.nullable().optional(),
}).passthrough();

export type AutonomousPreparationCheckpoint = z.infer<
  typeof autonomousPreparationCheckpointSchema
>;

export type AutonomousProviderExecution =
  | { kind: "CALL_PROVIDER" }
  | { kind: "REPLAY_RESULT"; result: TayqanMeasurementReasonerResult };

export function isPreviewProviderKeyRecoveryEligible(rawCheckpoint: unknown): boolean {
  const parsed = autonomousPreparationCheckpointSchema.safeParse(rawCheckpoint ?? {});
  if (!parsed.success) return false;
  const checkpoint = parsed.data;
  return Boolean(
    checkpoint.providerAttempt
    && !checkpoint.providerResult
    && checkpoint.providerFailure
    && checkpoint.providerFailure.operationHash === checkpoint.providerAttempt.operationHash
    && checkpoint.providerFailure.providerDiagnostic?.providerCode === "credit_balance_exhausted"
    && checkpoint.providerRecovery?.reason === "FUNDED_PROJECT_KEY_RETRY"
    && checkpoint.providerRecovery.attemptCount === 3
    && !checkpoint.previewProviderKeyRecovery,
  );
}

export function authorizePreviewProviderKeyRecovery(
  rawCheckpoint: unknown,
  input: {
    jobId: string;
    authorizedAt: string;
    providerProjectId: string;
    providerRequestId: string | null;
  },
): AutonomousPreparationCheckpoint {
  const checkpoint = autonomousPreparationCheckpointSchema.parse(rawCheckpoint ?? {});
  if (!isPreviewProviderKeyRecoveryEligible(checkpoint)) {
    throw new AppError(
      "AUTONOMOUS_PREVIEW_PROVIDER_KEY_RECOVERY_NOT_ELIGIBLE",
      "This job-specific Preview provider-key recovery is unavailable or already consumed.",
      409,
    );
  }
  const consumedAt = input.authorizedAt;
  return {
    ...checkpoint,
    providerAttempt: null,
    providerResult: null,
    providerFailure: null,
    previewProviderKeyRecovery: {
      reason: PREVIEW_PROVIDER_KEY_CORRECTED_RECOVERY_REASON,
      jobId: input.jobId,
      authorizedAt: input.authorizedAt,
      consumedAt,
      providerProjectId: input.providerProjectId,
      providerRequestId: input.providerRequestId,
    },
  };
}

export function authorizeSingle429ProviderRecovery(
  rawCheckpoint: unknown,
  authorizedAt: string,
): AutonomousPreparationCheckpoint {
  const checkpoint = autonomousPreparationCheckpointSchema.parse(rawCheckpoint ?? {});
  const attempt = checkpoint.providerAttempt ?? null;
  const result = checkpoint.providerResult ?? null;
  const failure = checkpoint.providerFailure ?? null;
  if (!attempt || result || !failure || failure.operationHash !== attempt.operationHash) {
    throw new AppError(
      "AUTONOMOUS_PROVIDER_RECOVERY_NOT_ELIGIBLE",
      "Only a preserved failed provider attempt can receive controlled recovery.",
      409,
    );
  }
  const priorRecovery = checkpoint.providerRecovery ?? null;
  if (priorRecovery) {
    const isRemediatedCreditAdmissionFailure = priorRecovery.attemptCount < 3
      && failure.providerDiagnostic?.providerCode === "credit_balance_exhausted";
    if (isRemediatedCreditAdmissionFailure) {
      return {
        ...checkpoint,
        providerAttempt: null,
        providerResult: null,
        providerFailure: null,
        providerRecovery: {
          ...priorRecovery,
          authorizedAt,
          reason: "FUNDED_PROJECT_KEY_RETRY",
          attemptCount: priorRecovery.attemptCount + 1,
          credentialFailure: failure,
        },
      };
    }
    const isProvenPreProviderInfrastructureFailure = priorRecovery.attemptCount === 1
      && priorRecovery.reason === "SANITIZED_429_DIAGNOSTIC_RETRY"
      && failure.code === "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED"
      && !failure.providerDiagnostic;
    if (!isProvenPreProviderInfrastructureFailure) {
      throw new AppError(
        "AUTONOMOUS_PROVIDER_RECOVERY_ALREADY_USED",
        "The controlled provider recovery attempt has already been used.",
        409,
      );
    }
    return {
      ...checkpoint,
      providerAttempt: null,
      providerResult: null,
      providerFailure: null,
      providerRecovery: {
        ...priorRecovery,
        authorizedAt,
        reason: "PRE_PROVIDER_INFRASTRUCTURE_RETRY",
        attemptCount: 2,
        infrastructureFailure: failure,
      },
    };
  }
  const is429 = failure.providerDiagnostic?.httpStatus === 429
    || /HTTP 429/i.test(failure.message);
  if (!is429) {
    throw new AppError(
      "AUTONOMOUS_PROVIDER_RECOVERY_NOT_ELIGIBLE",
      "The preserved provider failure is not an HTTP 429 and cannot receive this recovery.",
      409,
    );
  }
  return {
    ...checkpoint,
    providerAttempt: null,
    providerResult: null,
    providerFailure: null,
    providerRecovery: {
      authorizedAt,
      reason: "SANITIZED_429_DIAGNOSTIC_RETRY",
      attemptCount: 1,
      originalAttempt: attempt,
      originalFailure: failure,
    },
  };
}

/**
 * Paid-call fail-closed rule shared by fresh execution and every retry.
 * Once an attempt is durable, a retry may only replay the matching validated
 * result. An uncertain response is never converted into another paid call.
 */
export function resolveAutonomousProviderExecution(
  rawCheckpoint: unknown,
): AutonomousProviderExecution {
  if (rawCheckpoint === null || rawCheckpoint === undefined) {
    return { kind: "CALL_PROVIDER" };
  }

  const checkpoint = autonomousPreparationCheckpointSchema.parse(rawCheckpoint);
  const attempt = checkpoint.providerAttempt ?? null;
  const result = checkpoint.providerResult ?? null;

  if (!attempt) {
    if (result) {
      throw new AppError(
        "AUTONOMOUS_PROVIDER_CHECKPOINT_INVALID",
        "The preserved provider result has no matching attempt checkpoint.",
        409,
      );
    }
    return { kind: "CALL_PROVIDER" };
  }

  if (!result) {
    const failure = checkpoint.providerFailure ?? null;
    if (failure?.operationHash === attempt.operationHash) {
      throw new AppError(failure.code, failure.message, failure.status);
    }
    throw new AppError(
      "AUTONOMOUS_PROVIDER_ATTEMPT_INCOMPLETE",
      "Quantara found an uncertain provider attempt and will not make another provider request. The preserved operation requires safe recovery.",
      409,
    );
  }

  if (result.operationHash !== attempt.operationHash) {
    throw new AppError(
      "AUTONOMOUS_PROVIDER_RESULT_SCOPE_MISMATCH",
      "The provider result checkpoint does not belong to this operation.",
      409,
    );
  }

  return { kind: "REPLAY_RESULT", result: result.value };
}
