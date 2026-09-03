import { ExtractionJobStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION,
  createAutonomousBOQOperationHash,
} from "../src/lib/autonomous-boq/preparation";
import {
  createAutonomousBoqPreparationService,
  selectAutonomousSourceRevisions,
  toAutonomousPreparationStatus,
  type AutonomousPreparationServiceDependencies,
  type AutonomousPreparationSourceRecord,
} from "../src/lib/services/autonomous-boq-preparation-service";

const IDS = {
  company: "10000000-0000-4000-8000-000000000001",
  user: "10000000-0000-4000-8000-000000000002",
  project: "10000000-0000-4000-8000-000000000003",
  engine: "10000000-0000-4000-8000-000000000004",
  boq: "10000000-0000-4000-8000-000000000005",
  fileR1: "10000000-0000-4000-8000-000000000006",
  fileR2: "10000000-0000-4000-8000-000000000007",
  job: "10000000-0000-4000-8000-000000000008",
} as const;

const actor = {
  userId: IDS.user,
  companyId: IDS.company,
  role: UserRole.COMPANY_OWNER,
  fullName: "Quantara Owner",
  email: "owner@example.test",
};

function configurationForTest() {
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
      id: IDS.fileR2,
      checksum: "a".repeat(64),
      revision: "R02",
      originalName: "drawing-R02.pdf",
    }],
  };
  return { ...base, operationHash: createAutonomousBOQOperationHash(base) };
}

function source(
  id: string,
  revisionNumber: string | null,
  createdAt: string,
  checksum = "a".repeat(64),
): AutonomousPreparationSourceRecord {
  return {
    id,
    companyId: IDS.company,
    projectId: IDS.project,
    originalName: `drawing-${revisionNumber ?? "none"}.pdf`,
    checksum,
    drawingNumber: "A-101",
    revisionNumber,
    status: "UPLOADED",
    extension: "pdf",
    classification: "ARCHITECTURAL_PLAN",
    createdAt: new Date(createdAt),
  };
}

describe("autonomous preparation source revision selection", () => {
  it("keeps only the highest strict R revision without using upload time", () => {
    const selected = selectAutonomousSourceRevisions([
      source(IDS.fileR2, "R02", "2026-01-01T00:00:00.000Z"),
      source(IDS.fileR1, "R01", "2026-02-01T00:00:00.000Z"),
    ]);

    expect(selected.conflicts).toEqual([]);
    expect(selected.sources.map((row) => row.id)).toEqual([IDS.fileR2]);
  });

  it("fails closed for arbitrary competing drawing revisions", () => {
    const selected = selectAutonomousSourceRevisions([
      source(IDS.fileR1, "P2", "2026-01-01T00:00:00.000Z"),
      source(IDS.fileR2, "A", "2026-02-01T00:00:00.000Z"),
    ]);

    expect(selected.sources).toEqual([]);
    expect(selected.conflicts).toEqual([
      expect.objectContaining({ code: "AMBIGUOUS_SOURCE_REVISION", drawingNumber: "A-101" }),
    ]);
  });

  it("does not collapse different unnamed drawings", () => {
    const first = { ...source(IDS.fileR1, null, "2026-01-01T00:00:00.000Z"), drawingNumber: null };
    const second = { ...source(IDS.fileR2, null, "2026-01-02T00:00:00.000Z"), drawingNumber: null };
    const selected = selectAutonomousSourceRevisions([first, second]);

    expect(selected.conflicts).toEqual([]);
    expect(selected.sources.map((row) => row.id).sort()).toEqual([IDS.fileR1, IDS.fileR2].sort());
  });
});

function serviceDependencies(): AutonomousPreparationServiceDependencies {
  const job = {
    id: IDS.job,
    companyId: IDS.company,
    projectId: IDS.project,
    projectFileId: IDS.fileR2,
    engineType: "QUANTITY_CALCULATION",
    provider: "local",
    status: ExtractionJobStatus.QUEUED,
    progressPercentage: 0,
    currentStep: "SOURCE_VALIDATION",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attempts: 0,
    maximumAttempts: 3,
    configurationJson: null,
    resultSummaryJson: null,
    usageMetadataJson: null,
    errorCode: null,
    errorMessage: null,
    createdByUserId: IDS.user,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as const;

  return {
    getProject: vi.fn().mockResolvedValue({
      id: IDS.project,
      slug: "project-q-001",
      companyId: IDS.company,
      industryEngineId: IDS.engine,
      industryEngine: {
        id: IDS.engine,
        key: "construction",
        name: "Construction",
        configJson: { supportedUnits: ["m3", "m2"], boqSections: [] },
      },
    }),
    synchronizeEnabledIndustry: vi.fn().mockResolvedValue(false),
    getEnabledIndustry: vi.fn().mockResolvedValue({
      id: IDS.engine,
      key: "construction",
      name: "Construction",
      configJson: { supportedUnits: ["m3", "m2"], boqSections: [] },
    }),
    listSources: vi.fn().mockResolvedValue([
      source(IDS.fileR1, "R01", "2026-02-01T00:00:00.000Z"),
      source(IDS.fileR2, "R02", "2026-01-01T00:00:00.000Z"),
    ]),
    findEditableBoq: vi.fn().mockResolvedValue({ id: IDS.boq }),
    findOrCreateJob: vi.fn().mockImplementation(async ({ configuration }) => ({
      job: { ...job, configurationJson: configuration },
      created: true,
    })),
    getJob: vi.fn().mockResolvedValue(job),
    getLatestJob: vi.fn().mockResolvedValue(job),
    requeueJob: vi.fn().mockResolvedValue(job),
    registerHandlers: vi.fn().mockResolvedValue(undefined),
    scheduleJob: vi.fn(),
  };
}

describe("autonomous preparation start and refresh", () => {
  it("uses the persisted project industry, freezes the selected revision, and schedules the idempotent job", async () => {
    const deps = serviceDependencies();
    const service = createAutonomousBoqPreparationService(deps);

    const status = await service.start(actor, "project-q-001", {
      sourceFileIds: [IDS.fileR1, IDS.fileR2],
    });

    expect(deps.getEnabledIndustry).toHaveBeenCalledWith(IDS.company, IDS.engine);
    expect(deps.synchronizeEnabledIndustry).toHaveBeenCalledWith(IDS.company, IDS.engine);
    expect((deps.synchronizeEnabledIndustry as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan((deps.getEnabledIndustry as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
    expect(deps.findOrCreateJob).toHaveBeenCalledWith(expect.objectContaining({
      createdByUserId: IDS.user,
      anchorProjectFileId: IDS.fileR2,
      configuration: expect.objectContaining({
        companyId: IDS.company,
        projectId: IDS.project,
        targetBoqId: IDS.boq,
        industry: expect.objectContaining({ key: "construction", engineId: IDS.engine }),
        frozenSources: [expect.objectContaining({ id: IDS.fileR2, revision: "R02" })],
      }),
    }));
    expect(deps.scheduleJob).toHaveBeenCalledWith(IDS.company, IDS.job);
    expect(status.stage).toBe("QUEUED");
  });

  it("rejects a source that is outside the tenant/project scope", async () => {
    const deps = serviceDependencies();
    deps.listSources = vi.fn().mockResolvedValue([
      { ...source(IDS.fileR2, "R02", "2026-01-01T00:00:00.000Z"), companyId: "20000000-0000-4000-8000-000000000001" },
    ]);
    const service = createAutonomousBoqPreparationService(deps);

    await expect(service.start(actor, "project-q-001", { sourceFileIds: [IDS.fileR2] }))
      .rejects.toMatchObject({ code: "AUTONOMOUS_SOURCE_SCOPE_INVALID" });
    expect(deps.findOrCreateJob).not.toHaveBeenCalled();
  });

  it("does not schedule a completed idempotent replay", async () => {
    const deps = serviceDependencies();
    deps.findOrCreateJob = vi.fn().mockImplementation(async ({ configuration }) => ({
      job: {
        ...(await deps.getJob(IDS.company, IDS.job)),
        configurationJson: configuration,
        status: ExtractionJobStatus.COMPLETED,
      },
      created: false,
    }));
    const service = createAutonomousBoqPreparationService(deps);

    await service.start(actor, "project-q-001", { sourceFileIds: [IDS.fileR1, IDS.fileR2] });

    expect(deps.scheduleJob).not.toHaveBeenCalled();
  });

  it("restarts a section-policy failure with synchronized configuration and the same frozen sources and BOQ", async () => {
    const deps = serviceDependencies();
    const failedConfiguration = configurationForTest();
    deps.getJob = vi.fn().mockResolvedValue({
      ...(await deps.getJob(IDS.company, IDS.job)),
      status: ExtractionJobStatus.FAILED,
      errorCode: "AUTONOMOUS_INDUSTRY_SECTION_MISSING",
      errorMessage: "Industry rule gross-floor-area refers to a BOQ section that is not enabled.",
      configurationJson: failedConfiguration,
    });
    deps.listSources = vi.fn().mockResolvedValue([
      source(IDS.fileR2, "R02", "2026-01-01T00:00:00.000Z"),
    ]);
    const service = createAutonomousBoqPreparationService(deps);

    await service.retry(actor, "project-q-001", IDS.job);

    expect(deps.requeueJob).not.toHaveBeenCalled();
    expect(deps.findOrCreateJob).toHaveBeenCalledWith(expect.objectContaining({
      anchorProjectFileId: IDS.fileR2,
      configuration: expect.objectContaining({
        targetBoqId: IDS.boq,
        frozenSources: [expect.objectContaining({ id: IDS.fileR2 })],
      }),
    }));
  });

  it("returns a persisted ready-for-rates state after refresh", () => {
    const status = toAutonomousPreparationStatus({
      ...(serviceDependencies().getJob as ReturnType<typeof vi.fn>).getMockImplementation?.(),
      id: IDS.job,
      companyId: IDS.company,
      projectId: IDS.project,
      projectFileId: IDS.fileR2,
      engineType: "QUANTITY_CALCULATION",
      provider: "local",
      status: ExtractionJobStatus.COMPLETED,
      progressPercentage: 100,
      currentStep: "READY_FOR_RATES",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-01-01T00:01:00.000Z"),
      failedAt: null,
      attempts: 1,
      maximumAttempts: 3,
      configurationJson: { targetBoqId: IDS.boq, frozenSources: [{ id: IDS.fileR2 }] },
      resultSummaryJson: { stage: "READY_FOR_RATES", readyForRates: true, exceptions: [] },
      usageMetadataJson: null,
      errorCode: null,
      errorMessage: null,
      createdByUserId: IDS.user,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    } as never);

    expect(status).toEqual(expect.objectContaining({
      id: IDS.job,
      stage: "READY_FOR_RATES",
      readyForRates: true,
      targetBoqId: IDS.boq,
      sourceFileIds: [IDS.fileR2],
    }));
  });

  it("allows safe retry after transient page preprocessing without making genuine missing evidence retryable", () => {
    const base = {
      id: IDS.job,
      companyId: IDS.company,
      projectId: IDS.project,
      projectFileId: IDS.fileR2,
      engineType: "QUANTITY_CALCULATION",
      provider: "local",
      status: ExtractionJobStatus.NEEDS_INPUT,
      progressPercentage: 35,
      currentStep: "SOURCE_PROCESSING",
      startedAt: new Date(), completedAt: null, failedAt: null,
      attempts: 1, maximumAttempts: 3,
      configurationJson: { targetBoqId: IDS.boq, frozenSources: [{ id: IDS.fileR2 }] },
      usageMetadataJson: null, errorCode: null, errorMessage: null,
      createdByUserId: IDS.user, createdAt: new Date(), updatedAt: new Date(),
    };

    expect(toAutonomousPreparationStatus({
      ...base,
      resultSummaryJson: { stage: "SOURCE_INPUT_REQUIRED", exceptions: [{ code: "SOURCE_PREPROCESSING_INCOMPLETE", message: "Still rendering" }] },
    } as never).retryable).toBe(true);
    expect(toAutonomousPreparationStatus({
      ...base,
      resultSummaryJson: { stage: "SOURCE_INPUT_REQUIRED", exceptions: [{ code: "OCR_REQUIRED", message: "Better drawing required" }] },
    } as never).retryable).toBe(false);
  });

  it("allows one recovery retry for a non-concept stale empty classification result", () => {
    const base = {
      id: IDS.job, companyId: IDS.company, projectId: IDS.project, projectFileId: IDS.fileR2,
      engineType: "QUANTITY_CALCULATION", provider: "local", status: ExtractionJobStatus.NEEDS_REVIEW,
      progressPercentage: 100, currentStep: "NEEDS_REVIEW", startedAt: new Date(), completedAt: null, failedAt: null,
      attempts: 1, maximumAttempts: 3,
      configurationJson: { targetBoqId: IDS.boq, frozenSources: [{ id: IDS.fileR2 }] },
      usageMetadataJson: null, errorCode: null, errorMessage: null,
      createdByUserId: IDS.user, createdAt: new Date(), updatedAt: new Date(),
    };

    expect(toAutonomousPreparationStatus({
      ...base,
      resultSummaryJson: {
        stage: "NEEDS_REVIEW",
        categoryStatus: "VERIFIED",
        payableEligibility: "PAYABLE_ELIGIBLE",
        measuredSubjectCount: 0,
        addedItemCount: 0,
        providerResult: { value: { plan: { subjects: [] } } },
        exceptions: [],
      },
    } as never).retryable).toBe(true);

    expect(toAutonomousPreparationStatus({
      ...base,
      resultSummaryJson: {
        stage: "NEEDS_REVIEW",
        categoryStatus: "VERIFIED",
        payableEligibility: "PAYABLE_ELIGIBLE",
        measuredSubjectCount: 0,
        addedItemCount: 0,
        providerResult: {
          reasonerContractVersion: AUTONOMOUS_TAYQAN_REASONER_CONTRACT_VERSION,
          value: { plan: { subjects: [] } },
        },
        exceptions: [],
      },
    } as never).retryable).toBe(false);

    expect(toAutonomousPreparationStatus({
      ...base,
      resultSummaryJson: {
        stage: "NEEDS_REVIEW",
        categoryStatus: "REVIEW_REQUIRED",
        payableEligibility: "NOT_PAYABLE_CONCEPT",
        measuredSubjectCount: 0,
        addedItemCount: 0,
        providerResult: { value: { plan: { subjects: [] } } },
        exceptions: [{ code: "CONCEPT_DRAWING_NOT_PAYABLE", message: "Concept only" }],
      },
    } as never).retryable).toBe(false);
  });
});
