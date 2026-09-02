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

export const autonomousPreparationCheckpointSchema = z.object({
  providerAttempt: providerAttemptSchema.nullable().optional(),
  providerResult: providerResultCheckpointSchema.nullable().optional(),
}).passthrough();

export type AutonomousPreparationCheckpoint = z.infer<
  typeof autonomousPreparationCheckpointSchema
>;

export type AutonomousProviderExecution =
  | { kind: "CALL_PROVIDER" }
  | { kind: "REPLAY_RESULT"; result: TayqanMeasurementReasonerResult };

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
