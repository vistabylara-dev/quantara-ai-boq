import { describe, expect, it } from "vitest";
import {
  AUTONOMOUS_BOQ_PREPARATION_VERSION,
  authorizeSingle429ProviderRecovery,
  autonomousPreparationConfigurationSchema,
  createAutonomousBOQOperationHash,
  resolveAutonomousProviderExecution,
} from "@/lib/autonomous-boq/preparation";

const COMPANY_A = "10000000-0000-4000-8000-000000000001";
const COMPANY_B = "10000000-0000-4000-8000-000000000002";
const PROJECT_A = "20000000-0000-4000-8000-000000000001";
const BOQ_A = "30000000-0000-4000-8000-000000000001";
const ENGINE_A = "40000000-0000-4000-8000-000000000001";

const sourceA = {
  id: "50000000-0000-4000-8000-000000000001",
  checksum: "a".repeat(64),
  revision: "R01",
  originalName: "A-101.pdf",
};

const sourceB = {
  id: "50000000-0000-4000-8000-000000000002",
  checksum: "b".repeat(64),
  revision: "R02",
  originalName: "S-201.pdf",
};

function configuration(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: AUTONOMOUS_BOQ_PREPARATION_VERSION,
    operationHash: "pending",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    targetBoqId: BOQ_A,
    industry: {
      engineId: ENGINE_A,
      key: "construction",
      name: "Construction",
      policyVersion: "industry-policy-v1",
      configurationHash: "c".repeat(64),
    },
    frozenSources: [sourceA, sourceB],
    ...overrides,
  };
}

describe("autonomous BOQ operation identity", () => {
  it("is stable for the same exact frozen scope regardless of input order", () => {
    const first = configuration();
    const second = configuration({ frozenSources: [sourceB, sourceA] });

    expect(createAutonomousBOQOperationHash(first)).toBe(
      createAutonomousBOQOperationHash(second),
    );
  });

  it("binds tenant, project, target BOQ, industry policy and source revision", () => {
    const base = configuration();
    const baseHash = createAutonomousBOQOperationHash(base);

    expect(createAutonomousBOQOperationHash(configuration({ companyId: COMPANY_B }))).not.toBe(baseHash);
    expect(createAutonomousBOQOperationHash(configuration({ projectId: "20000000-0000-4000-8000-000000000002" }))).not.toBe(baseHash);
    expect(createAutonomousBOQOperationHash(configuration({ targetBoqId: "30000000-0000-4000-8000-000000000002" }))).not.toBe(baseHash);
    expect(createAutonomousBOQOperationHash(configuration({
      industry: { ...base.industry, key: "interior-fitout" },
    }))).not.toBe(baseHash);
    expect(createAutonomousBOQOperationHash(configuration({
      industry: { ...base.industry, configurationHash: "d".repeat(64) },
    }))).not.toBe(baseHash);
    expect(createAutonomousBOQOperationHash(configuration({
      frozenSources: [{ ...sourceA, revision: "R03" }, sourceB],
    }))).not.toBe(baseHash);
  });

  it("rejects a configuration whose persisted operation hash does not match its frozen contract", () => {
    const candidate = configuration();
    const valid = {
      ...candidate,
      operationHash: createAutonomousBOQOperationHash(candidate),
    };

    expect(autonomousPreparationConfigurationSchema.parse(valid).operationHash).toBe(valid.operationHash);
    expect(() => autonomousPreparationConfigurationSchema.parse({
      ...valid,
      frozenSources: [{ ...sourceA, checksum: "e".repeat(64) }, sourceB],
    })).toThrow(/operation hash/i);
  });
});

describe("autonomous provider replay safety", () => {
  const providerResult = {
    provider: "test-provider",
    model: "deterministic-fixture",
    responseIds: ["response-1"],
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

  it("permits one fresh call only before an attempt checkpoint exists", () => {
    expect(resolveAutonomousProviderExecution(null)).toEqual({ kind: "CALL_PROVIDER" });
  });

  it("replays a durably checkpointed validated result without another provider call", () => {
    expect(resolveAutonomousProviderExecution({
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
      providerResult: { operationHash: "a".repeat(64), checkpointedAt: "2026-09-02T00:00:01.000Z", value: providerResult },
    })).toEqual({ kind: "REPLAY_RESULT", result: providerResult });
  });

  it("fails closed after an uncertain provider attempt with no result", () => {
    expect(() => resolveAutonomousProviderExecution({
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
      providerResult: null,
    })).toThrow(/will not make another provider request/i);
  });

  it("preserves the original sanitized provider failure while still failing closed", () => {
    expect(() => resolveAutonomousProviderExecution({
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
      providerResult: null,
      providerFailure: {
        operationHash: "a".repeat(64),
        failedAt: "2026-09-02T00:00:01.000Z",
        code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
        message: "Provider rejected the configured model (HTTP 400).",
        status: 503,
      },
    })).toThrow(/configured model/);
  });

  it("allows a single explicitly checkpointed 429 recovery call", () => {
    expect(resolveAutonomousProviderExecution({
      providerAttempt: null,
      providerResult: null,
      providerFailure: null,
      providerRecovery: {
        authorizedAt: "2026-09-03T00:00:00.000Z",
        reason: "SANITIZED_429_DIAGNOSTIC_RETRY",
        attemptCount: 1,
      },
    })).toEqual({ kind: "CALL_PROVIDER" });
  });

  it("authorizes exactly one recovery from a preserved HTTP 429", () => {
    const initial = {
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
      providerResult: null,
      providerFailure: {
        operationHash: "a".repeat(64),
        failedAt: "2026-09-02T00:00:01.000Z",
        code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
        message: "Provider rejected the request (HTTP 429).",
        status: 503,
      },
    };
    const recovered = authorizeSingle429ProviderRecovery(initial, "2026-09-03T00:00:00.000Z");
    expect(recovered).toMatchObject({
      providerAttempt: null,
      providerFailure: null,
      providerRecovery: { attemptCount: 1, originalFailure: initial.providerFailure },
    });
    expect(() => authorizeSingle429ProviderRecovery({
      ...initial,
      providerRecovery: recovered.providerRecovery,
    }, "2026-09-03T00:01:00.000Z")).toThrow(/already been used/i);
  });

  it("permits one separately audited retry when the diagnostic run failed before provider contact", () => {
    const originalFailure = {
      operationHash: "a".repeat(64),
      failedAt: "2026-09-02T00:00:01.000Z",
      code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
      message: "Provider rejected the request (HTTP 429).",
      status: 503,
    };
    const recovered = authorizeSingle429ProviderRecovery({
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-03T00:00:00.000Z" },
      providerFailure: {
        operationHash: "a".repeat(64),
        failedAt: "2026-09-03T00:00:01.000Z",
        code: "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED",
        message: "The measurement pipeline failed before provider contact.",
        status: 503,
      },
      providerRecovery: {
        authorizedAt: "2026-09-03T00:00:00.000Z",
        reason: "SANITIZED_429_DIAGNOSTIC_RETRY",
        attemptCount: 1,
        originalAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
        originalFailure,
      },
    }, "2026-09-03T00:02:00.000Z");
    expect(recovered.providerRecovery).toMatchObject({
      reason: "PRE_PROVIDER_INFRASTRUCTURE_RETRY",
      attemptCount: 2,
      originalFailure,
      infrastructureFailure: { code: "TAYQAN_MEASUREMENT_AI_EXECUTION_FAILED" },
    });
  });

  it("rejects a result checkpoint from another operation", () => {
    expect(() => resolveAutonomousProviderExecution({
      providerAttempt: { operationHash: "a".repeat(64), startedAt: "2026-09-02T00:00:00.000Z" },
      providerResult: { operationHash: "b".repeat(64), checkpointedAt: "2026-09-02T00:00:01.000Z", value: providerResult },
    })).toThrow(/checkpoint does not belong/i);
  });
});
