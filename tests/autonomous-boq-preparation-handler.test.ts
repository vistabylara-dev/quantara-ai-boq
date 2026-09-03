import { ExtractionJobStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createAutonomousBOQOperationHash } from "../src/lib/autonomous-boq/preparation";
import { AppError } from "../src/lib/errors/app-error";
import {
  createAutonomousBoqPreparationHandler,
  type AutonomousBoqPreparationHandlerDependencies,
} from "../src/lib/jobs/autonomous-boq-preparation-handler";

const IDS = {
  company: "30000000-0000-4000-8000-000000000001",
  user: "30000000-0000-4000-8000-000000000002",
  project: "30000000-0000-4000-8000-000000000003",
  engine: "30000000-0000-4000-8000-000000000004",
  boq: "30000000-0000-4000-8000-000000000005",
  file: "30000000-0000-4000-8000-000000000006",
  job: "30000000-0000-4000-8000-000000000007",
} as const;

function configuration() {
  const base = {
    contractVersion: "autonomous-boq-preparation-v1" as const,
    companyId: IDS.company,
    projectId: IDS.project,
    targetBoqId: IDS.boq,
    industry: {
      engineId: IDS.engine,
      key: "construction",
      name: "Construction",
      policyVersion: "autonomous-boq-policy/v1",
      configurationHash: "b".repeat(64),
    },
    frozenSources: [{
      id: IDS.file,
      checksum: "c".repeat(64),
      revision: "R01",
      originalName: "A-101.pdf",
    }],
  };
  return { ...base, operationHash: createAutonomousBOQOperationHash(base) };
}

function job(resultSummaryJson: unknown = null) {
  return {
    id: IDS.job,
    companyId: IDS.company,
    projectId: IDS.project,
    projectFileId: IDS.file,
    engineType: "QUANTITY_CALCULATION",
    provider: "local",
    status: ExtractionJobStatus.RUNNING,
    progressPercentage: 0,
    currentStep: "SOURCE_VALIDATION",
    startedAt: new Date(),
    completedAt: null,
    failedAt: null,
    attempts: 1,
    maximumAttempts: 3,
    configurationJson: configuration(),
    resultSummaryJson,
    usageMetadataJson: null,
    errorCode: null,
    errorMessage: null,
    createdByUserId: IDS.user,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;
}

const providerResult = {
  provider: "openai",
  model: "test-model",
  responseIds: ["resp_1"],
  plan: { subjects: [], exceptions: [] },
  seniorReview: {
    clusterReviewCount: 1,
    globalReviewApplied: true,
    acceptedSubjectCount: 0,
    rejectedSubjectCount: 0,
    findingCount: 0,
    evidencePageCoveragePercent: 100,
  },
};

function dependencies(): AutonomousBoqPreparationHandlerDependencies {
  return {
    loadActor: vi.fn().mockResolvedValue({
      userId: IDS.user,
      companyId: IDS.company,
      role: UserRole.COMPANY_OWNER,
      fullName: "Quantara System Owner",
      email: "owner@example.test",
    }),
    validateFrozenScope: vi.fn().mockResolvedValue({
      projectSlug: "project-q-001",
      industryContext: {
        engineId: "construction",
        key: "construction",
        name: "Construction",
        policyVersion: "autonomous-boq-policy/v1",
        configurationHash: "b".repeat(64),
        supportedUnits: ["m3", "m2"],
        sections: [{ code: "FND", title: "Foundations" }],
        supportedCalculationTypes: ["CONCRETE_VOLUME"],
        rules: [{ id: "foundation-concrete", sectionCode: "FND", title: "Foundation concrete", calculationType: "CONCRETE_VOLUME", resultUnit: "m3" }],
      },
    }),
    ensureSourcesProcessed: vi.fn().mockResolvedValue({ state: "READY", exceptions: [] }),
    measure: vi.fn().mockImplementation(async (_actor, _slug, _input, options) => {
      await options.onReasonerStart?.();
      await options.onReasonerResult?.(providerResult);
      return {
        measuredSubjectCount: 0,
        createdEntityCount: 0,
        reusedEntityCount: 0,
        createdCalculationCount: 0,
        reusedCalculationCount: 0,
        exceptionCount: 0,
        exceptions: [],
        provider: "openai",
        model: "test-model",
        seniorReview: providerResult.seniorReview,
      };
    }),
    checkpoint: vi.fn().mockResolvedValue(undefined),
    assemble: vi.fn().mockResolvedValue({
      state: "READY_FOR_RATES",
      boqId: IDS.boq,
      addedItemCount: 2,
      duplicateItemCount: 0,
      exceptions: [],
    }),
    now: vi.fn()
      .mockReturnValueOnce(new Date("2026-01-01T00:00:00.000Z"))
      .mockReturnValue(new Date("2026-01-01T00:01:00.000Z")),
  };
}

const ctx = {
  updateProgress: vi.fn().mockResolvedValue(undefined),
  isCancelled: vi.fn().mockResolvedValue(false),
};

describe("autonomous preparation handler", () => {
  it("checkpoints the provider boundary before persisting system-validated measurements", async () => {
    const deps = dependencies();
    const handler = createAutonomousBoqPreparationHandler(deps);

    const result = await handler(job(), ctx);

    const providerCheckpoints = (deps.checkpoint as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, , patch]) => patch.providerAttempt || patch.providerResult,
    );
    expect(providerCheckpoints[0]).toEqual([IDS.company, IDS.job, {
      providerAttempt: {
        operationHash: configuration().operationHash,
        startedAt: "2026-01-01T00:00:00.000Z",
      },
    }]);
    expect(providerCheckpoints[1]).toEqual([IDS.company, IDS.job, {
      providerResult: {
        operationHash: configuration().operationHash,
        checkpointedAt: "2026-01-01T00:01:00.000Z",
        value: providerResult,
      },
    }]);
    expect(deps.measure).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: IDS.company }),
      "project-q-001",
      expect.objectContaining({
        projectId: IDS.project,
        sourceFileIds: [IDS.file],
        targetBoqId: IDS.boq,
        governingContext: expect.objectContaining({ industryPolicy: expect.objectContaining({ key: "construction" }) }),
      }),
      expect.objectContaining({
        completionAuditOperationId: configuration().operationHash,
        persistencePolicy: expect.objectContaining({
          mode: "SYSTEM_VALIDATED",
          calculatedByPrefix: `UNIVERSAL:autonomous-boq/v1:${configuration().operationHash}:`,
        }),
      }),
    );
    expect(result.status).toBe(ExtractionJobStatus.COMPLETED);
    expect(result.resultSummary).toEqual(expect.objectContaining({ stage: "READY_FOR_RATES", readyForRates: true }));
  });

  it("replays a matching durable provider result without exposing fresh-call callbacks", async () => {
    const config = configuration();
    const checkpoint = {
      providerAttempt: { operationHash: config.operationHash, startedAt: "2026-01-01T00:00:00.000Z" },
      providerResult: { operationHash: config.operationHash, checkpointedAt: "2026-01-01T00:01:00.000Z", value: providerResult },
    };
    const deps = dependencies();
    deps.measure = vi.fn().mockResolvedValue({
      measuredSubjectCount: 0,
      createdEntityCount: 0,
      reusedEntityCount: 0,
      createdCalculationCount: 0,
      reusedCalculationCount: 0,
      exceptionCount: 0,
      exceptions: [],
      provider: "openai",
      model: "test-model",
      seniorReview: providerResult.seniorReview,
    });
    const handler = createAutonomousBoqPreparationHandler(deps);

    await handler(job(checkpoint), ctx);

    const options = (deps.measure as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(options.replayReasonerResult).toEqual(providerResult);
    expect(options.onReasonerStart).toBeUndefined();
    expect(options.onReasonerResult).toBeUndefined();
    const providerCheckpoints = (deps.checkpoint as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, , patch]) => patch.providerAttempt || patch.providerResult,
    );
    expect(providerCheckpoints).toHaveLength(0);
  });

  it("does not replay a stale empty provider result after rendered evidence becomes classifiable", async () => {
    const config = configuration();
    const staleCheckpoint = {
      providerAttempt: { operationHash: config.operationHash, startedAt: "2026-01-01T00:00:00.000Z" },
      providerResult: { operationHash: config.operationHash, checkpointedAt: "2026-01-01T00:01:00.000Z", value: providerResult },
      measuredSubjectCount: 0,
      addedItemCount: 0,
    };
    const deps = dependencies();
    deps.ensureSourcesProcessed = vi.fn().mockResolvedValue({ state: "READY", exceptions: [], evidenceChanged: true });
    deps.measure = vi.fn().mockImplementation(async (_actor, _slug, _input, options) => {
      expect(options.replayReasonerResult).toBeUndefined();
      await options.onReasonerStart?.();
      await options.onReasonerResult?.(providerResult);
      return {
        measuredSubjectCount: 2,
        createdEntityCount: 2,
        reusedEntityCount: 0,
        createdCalculationCount: 2,
        reusedCalculationCount: 0,
        exceptionCount: 0,
        exceptions: [],
        provider: "openai",
        model: "test-model",
        seniorReview: { ...providerResult.seniorReview, acceptedSubjectCount: 2 },
      };
    });
    const handler = createAutonomousBoqPreparationHandler(deps);

    const result = await handler(job(staleCheckpoint), ctx);

    expect(result.status).toBe(ExtractionJobStatus.COMPLETED);
    expect(result.resultSummary).toEqual(expect.objectContaining({
      stage: "READY_FOR_RATES",
      measuredSubjectCount: 2,
      addedItemCount: 2,
    }));
    expect(deps.checkpoint).toHaveBeenCalledWith(IDS.company, IDS.job, expect.objectContaining({
      providerAttempt: null,
      providerResult: null,
      staleEmptyProviderResultDiscardedAt: expect.any(String),
    }));
  });

  it("refuses a second paid request after an uncertain provider attempt", async () => {
    const config = configuration();
    const deps = dependencies();
    const handler = createAutonomousBoqPreparationHandler(deps);

    await expect(handler(job({
      providerAttempt: { operationHash: config.operationHash, startedAt: "2026-01-01T00:00:00.000Z" },
    }), ctx)).rejects.toMatchObject({ code: "AUTONOMOUS_PROVIDER_ATTEMPT_INCOMPLETE" });
    expect(deps.measure).not.toHaveBeenCalled();
  });

  it("durably preserves a sanitized provider failure before the queue retries", async () => {
    const providerDiagnostic = {
      classification: "rate_limit_exceeded",
      providerCode: "rate_limit_exceeded",
      providerType: "tokens",
      httpStatus: 429,
      requestId: "req_rate_limit",
      organizationId: "org_funded",
      projectId: "proj_funded",
      retryAfter: "3",
      tokenLimit: "30000",
      remainingTokens: "0",
      tokenReset: "3s",
    };
    const deps = dependencies();
    deps.measure = vi.fn().mockImplementation(async (_actor, _project, _input, options) => {
      await options.onReasonerStart?.();
      const error = new AppError(
        "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
        "Provider rejected the configured model (HTTP 429; rate_limit_exceeded).",
        503,
      );
      Object.assign(error, { providerDiagnostic });
      throw error;
    });
    const handler = createAutonomousBoqPreparationHandler(deps);

    await expect(handler(job(), ctx)).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
    });
    expect(deps.checkpoint).toHaveBeenCalledWith(
      IDS.company,
      IDS.job,
      expect.objectContaining({
        providerFailure: expect.objectContaining({
          code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
          status: 503,
          providerDiagnostic,
        }),
      }),
    );
  });

  it("stops before the provider when source processing needs input", async () => {
    const deps = dependencies();
    deps.ensureSourcesProcessed = vi.fn().mockResolvedValue({
      state: "NEEDS_INPUT",
      exceptions: [{ code: "CAD_CONNECTOR_REQUIRED", message: "A native CAD connector is required.", sourceFileIds: [IDS.file] }],
    });
    const handler = createAutonomousBoqPreparationHandler(deps);

    const result = await handler(job(), ctx);

    expect(result.status).toBe(ExtractionJobStatus.NEEDS_INPUT);
    expect(result.resultSummary).toEqual(expect.objectContaining({ stage: "SOURCE_INPUT_REQUIRED", readyForRates: false }));
    expect(deps.measure).not.toHaveBeenCalled();
  });
});
