import { describe, expect, it } from "vitest";
import { demoIndustries } from "@/config/industries";
import {
  AUTONOMOUS_BOQ_CONTRACT_VERSION,
  applyManualQuantityOverride,
  assembleAutonomousBoqDraft,
  buildAutonomousOperationIdentity,
  freezeAutonomousSources,
  listAutonomousIndustryPolicies,
  resolveAutonomousIndustry,
} from "@/lib/autonomous-boq";
import {
  REPRESENTATIVE_FAMILY_FIXTURES,
  REPRESENTATIVE_INDUSTRY_FIXTURES,
  UNSUPPORTED_DESIGN_FIXTURES,
} from "./fixtures/autonomous-boq/representative-industries";

const COMPANY_ID = "10000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const BOQ_ID = "30000000-0000-4000-8000-000000000001";
const EVALUATED_AT = "2026-09-02T08:00:00.000Z";

function supportedContext(requestedIndustry: string) {
  const resolved = resolveAutonomousIndustry(requestedIndustry);
  expect(resolved.status).toBe("SUPPORTED");
  if (resolved.status !== "SUPPORTED") throw new Error(resolved.reason);
  return resolved.context;
}

function assembleFixture(fixture: (typeof REPRESENTATIVE_INDUSTRY_FIXTURES)[number]) {
  const industry = supportedContext(fixture.engineId);
  const frozenSources = freezeAutonomousSources([fixture.frozenSource]);
  const operation = buildAutonomousOperationIdentity({
    companyId: COMPANY_ID,
    projectId: PROJECT_ID,
    targetBoqId: BOQ_ID,
    industry,
    frozenSources,
  });
  return assembleAutonomousBoqDraft({
    operation,
    industry,
    frozenSources,
    candidates: [fixture.measurement],
    unsupportedScopes: [],
    evaluatedAt: EVALUATED_AT,
  });
}

describe("autonomous BOQ industry policy contract", () => {
  it("covers exactly the ten enabled engines and accounts for every advertised calculation capability", () => {
    const enabledIds = demoIndustries.map((engine) => engine.id).sort();
    const policies = listAutonomousIndustryPolicies();
    expect(policies.map((policy) => policy.engineId).sort()).toEqual(enabledIds);
    expect(policies).toHaveLength(10);

    for (const policy of policies) {
      const engine = demoIndustries.find((candidate) => candidate.id === policy.engineId);
      expect(engine).toBeDefined();
      const accountedFor = new Set([
        ...policy.rules.flatMap((rule) => rule.declaredCapabilities),
        ...policy.unsupportedCapabilities.map((capability) => capability.capability),
      ]);
      expect(engine?.calculationTypes.filter((capability) => !accountedFor.has(capability))).toEqual([]);
      expect(policy.rules.every((rule) => engine?.supportedUnits.includes(rule.boqUnit))).toBe(true);
      expect(policy.rules.every((rule) => engine?.boqSections.some((section) => section.id === rule.sectionId))).toBe(true);
    }
  });

  it("maps architectural, civil, structural and infrastructure families only onto supported rule subsets", () => {
    const expected = {
      architectural: "interior-fitout",
      civil: "construction",
      structural: "construction",
      infrastructure: "construction",
    } as const;

    for (const [family, engineId] of Object.entries(expected)) {
      const resolved = resolveAutonomousIndustry(family);
      expect(resolved).toMatchObject({ status: "SUPPORTED", context: { requestedIndustry: family, engineId } });
      if (resolved.status !== "SUPPORTED") continue;
      expect(resolved.context.allowedRuleIds.length).toBeGreaterThan(0);
      expect(resolved.context.allowedRuleIds.every((ruleId) => resolved.context.policy.rules.some((rule) => rule.id === ruleId))).toBe(true);
    }
  });

  it.each(REPRESENTATIVE_FAMILY_FIXTURES)(
    "executes the bounded $requestedIndustry family through its real $engineId policy",
    ({ requestedIndustry, engineId }) => {
      const fixture = REPRESENTATIVE_INDUSTRY_FIXTURES.find((entry) => entry.engineId === engineId);
      if (!fixture) throw new Error(`Missing representative fixture for ${engineId}`);
      const industry = supportedContext(requestedIndustry);
      const frozenSources = freezeAutonomousSources([fixture.frozenSource]);
      const operation = buildAutonomousOperationIdentity({ companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry, frozenSources });
      const draft = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [fixture.measurement], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
      expect(draft.industry).toMatchObject({ requestedIndustry, engineId });
      expect(draft.completion).toMatchObject({ technicalComplete: true, onlyRatesBlock: true });
    },
  );

  it("blocks facilities management because no enabled measurement policy exists", () => {
    expect(resolveAutonomousIndustry("facilities-management")).toEqual({
      status: "BLOCKED",
      requestedIndustry: "facilities-management",
      code: "UNSUPPORTED_INDUSTRY_FAMILY",
      reason: "Facilities management has no enabled autonomous measurement policy.",
    });
  });

  it("keeps Joinery on its specialized canonical assembly boundary", () => {
    const resolved = resolveAutonomousIndustry("joinery");
    expect(resolved).toMatchObject({ status: "SUPPORTED", context: { policy: { assemblyMode: "SPECIALIZED_JOINERY" } } });
  });
});

describe("autonomous BOQ deterministic domain", () => {
  it("maps explicit Construction gross floor area into the enabled Measured Areas section as an unpriced item", () => {
    const industry = supportedContext("construction");
    const frozenSources = freezeAutonomousSources([{
      fileId: "00000000-0000-4000-8000-000000000011",
      checksumSha256: "b".repeat(64),
      drawingIdentity: "A-001",
      revision: "R01",
      pageIds: ["construction-gfa-page-1"],
    }]);
    const operation = buildAutonomousOperationIdentity({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      targetBoqId: BOQ_ID,
      industry,
      frozenSources,
    });
    const draft = assembleAutonomousBoqDraft({
      operation,
      industry,
      frozenSources,
      candidates: [{
        candidateId: "construction-gfa-1",
        subjectKey: "construction:gross-floor-area",
        ruleId: "gross-floor-area",
        description: "Explicit gross floor area",
        formulaInputs: { netFloorArea: 1250 },
        evidence: [{
          evidenceId: "construction-gfa-evidence-1",
          sourceFileId: frozenSources.sources[0]!.fileId,
          pageId: "construction-gfa-page-1",
          role: "PRIMARY",
          reference: "A-001 / R01 / page 1",
        }],
        reconciliation: { status: "DIRECT", evidenceIds: ["construction-gfa-evidence-1"] },
      }],
      unsupportedScopes: [],
      evaluatedAt: EVALUATED_AT,
    });

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ sectionId: "area-schedules", quantity: 1250, unit: "m2", rate: 0 });
    expect(draft.completion).toMatchObject({ readyForRates: true, onlyRatesBlock: true });
  });

  it.each(REPRESENTATIVE_INDUSTRY_FIXTURES)(
    "builds a technically complete, evidence-linked, unpriced $engineId item",
    (fixture) => {
      const draft = assembleFixture(fixture);
      expect(draft.contractVersion).toBe(AUTONOMOUS_BOQ_CONTRACT_VERSION);
      expect(draft.industry.engineId).toBe(fixture.engineId);
      expect(draft.industry.engineConfigHash).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.industry.policyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.frozenSourceScopeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.exceptions).toEqual([]);
      expect(draft.items).toHaveLength(1);
      expect(draft.items[0]).toMatchObject({
        quantity: fixture.expectedQuantity,
        unit: fixture.expectedUnit,
        rate: 0,
        quantityValidation: {
          mode: "SYSTEM_VALIDATED",
          actorUserId: null,
          validatedAt: EVALUATED_AT,
          originalSystemQuantity: fixture.expectedQuantity,
        },
        rateValidation: { mode: "AWAITING_USER_RATE" },
      });
      expect(draft.items[0].quantity).toBeGreaterThan(0);
      expect(draft.items[0].evidence).toHaveLength(1);
      expect(draft.completion).toEqual({
        technicalComplete: true,
        readyForRates: true,
        onlyRatesBlock: true,
        blockers: ["UNIT_RATES_REQUIRED"],
      });
    },
  );

  it("hashes sorted frozen source identity, checksums, revisions and industry context into the operation identity", () => {
    const first = REPRESENTATIVE_INDUSTRY_FIXTURES[0];
    const second = REPRESENTATIVE_INDUSTRY_FIXTURES[1];
    const industry = supportedContext("construction");
    const forward = freezeAutonomousSources([first.frozenSource, second.frozenSource]);
    const reverse = freezeAutonomousSources([second.frozenSource, first.frozenSource]);
    const input = { companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry };
    const firstHash = buildAutonomousOperationIdentity({ ...input, frozenSources: forward }).operationHash;
    expect(buildAutonomousOperationIdentity({ ...input, frozenSources: reverse }).operationHash).toBe(firstHash);

    const revised = freezeAutonomousSources([{ ...first.frozenSource, revision: "R02" }, second.frozenSource]);
    expect(buildAutonomousOperationIdentity({ ...input, frozenSources: revised }).operationHash).not.toBe(firstHash);

    const changedChecksum = freezeAutonomousSources([{ ...first.frozenSource, checksumSha256: "f".repeat(64) }, second.frozenSource]);
    expect(buildAutonomousOperationIdentity({ ...input, frozenSources: changedChecksum }).operationHash).not.toBe(firstHash);
    expect(buildAutonomousOperationIdentity({ ...input, industry: supportedContext("interior-fitout"), frozenSources: forward }).operationHash).not.toBe(firstHash);
    expect(buildAutonomousOperationIdentity({ ...input, industry: { ...industry, policyHash: "f".repeat(64) }, frozenSources: forward }).operationHash).not.toBe(firstHash);
  });

  it("deduplicates byte-identical measurement subjects and blocks conflicting duplicate results", () => {
    const fixture = REPRESENTATIVE_INDUSTRY_FIXTURES[0];
    const industry = supportedContext(fixture.engineId);
    const frozenSources = freezeAutonomousSources([fixture.frozenSource]);
    const operation = buildAutonomousOperationIdentity({ companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry, frozenSources });
    const duplicate = { ...fixture.measurement, candidateId: "duplicate-candidate" };
    const deduped = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [fixture.measurement, duplicate], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
    expect(deduped.items).toHaveLength(1);
    expect(deduped.deduplicatedCandidateIds).toEqual(["duplicate-candidate"]);

    const conflict = { ...fixture.measurement, candidateId: "conflicting-candidate", formulaInputs: { length: 9, width: 4, depth: 0.3 } };
    const blocked = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [fixture.measurement, conflict], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
    expect(blocked.items).toEqual([]);
    expect(blocked.exceptions).toEqual([expect.objectContaining({ code: "DUPLICATE_MEASUREMENT_CONFLICT", blocking: true })]);
    expect(blocked.completion.technicalComplete).toBe(false);
  });

  it("blocks mixed revisions of one drawing identity", () => {
    const fixture = REPRESENTATIVE_INDUSTRY_FIXTURES[0];
    const older = fixture.frozenSource;
    const newer = { ...older, fileId: "00000000-0000-4000-8000-999999999999", revision: "R02", pageIds: ["construction-page-2"] };
    const industry = supportedContext(fixture.engineId);
    const frozenSources = freezeAutonomousSources([older, newer]);
    const operation = buildAutonomousOperationIdentity({ companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry, frozenSources });
    const candidate = {
      ...fixture.measurement,
      evidence: [
        fixture.measurement.evidence[0],
        { evidenceId: "newer-revision", sourceFileId: newer.fileId, pageId: newer.pageIds[0], role: "SUPPORTING" as const, reference: "CONSTRUCTION-PLAN-001 / R02 / page 1" },
      ],
      reconciliation: { status: "RECONCILED" as const, evidenceIds: [fixture.measurement.evidence[0].evidenceId, "newer-revision"] },
    };
    const draft = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [candidate], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
    expect(draft.exceptions).toEqual([expect.objectContaining({ code: "REVISION_CONFLICT", blocking: true })]);
  });

  it("requires explicit reconciliation across sources and accepts it only when every cited evidence record is covered", () => {
    const fixture = REPRESENTATIVE_INDUSTRY_FIXTURES[6];
    const schedule = {
      ...fixture.frozenSource,
      fileId: "00000000-0000-4000-8000-888888888888",
      checksumSha256: "e".repeat(64),
      drawingIdentity: "PLUMBING-SCHEDULE-001",
      pageIds: ["plumbing-schedule-page-1"],
    };
    const industry = supportedContext(fixture.engineId);
    const frozenSources = freezeAutonomousSources([fixture.frozenSource, schedule]);
    const operation = buildAutonomousOperationIdentity({ companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry, frozenSources });
    const supporting = { evidenceId: "plumbing-schedule-evidence", sourceFileId: schedule.fileId, pageId: schedule.pageIds[0], role: "SUPPORTING" as const, reference: "PLUMBING-SCHEDULE-001 / R01 / page 1" };
    const unreconciled = { ...fixture.measurement, evidence: [...fixture.measurement.evidence, supporting] };
    const blocked = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [unreconciled], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
    expect(blocked.exceptions).toEqual([expect.objectContaining({ code: "RECONCILIATION_REQUIRED", blocking: true })]);

    const reconciled = {
      ...unreconciled,
      reconciliation: { status: "RECONCILED" as const, evidenceIds: unreconciled.evidence.map((evidence) => evidence.evidenceId) },
    };
    const accepted = assembleAutonomousBoqDraft({ operation, industry, frozenSources, candidates: [reconciled], unsupportedScopes: [], evaluatedAt: EVALUATED_AT });
    expect(accepted.exceptions).toEqual([]);
    expect(accepted.items).toHaveLength(1);
  });

  it.each(UNSUPPORTED_DESIGN_FIXTURES)(
    "turns unsupported $engineId $capability sizing into an evidence-linked blocking exception",
    ({ engineId, capability, code }) => {
      const fixture = REPRESENTATIVE_INDUSTRY_FIXTURES.find((entry) => entry.engineId === engineId);
      if (!fixture) throw new Error(`Missing fixture for ${engineId}`);
      const industry = supportedContext(engineId);
      const frozenSources = freezeAutonomousSources([fixture.frozenSource]);
      const operation = buildAutonomousOperationIdentity({ companyId: COMPANY_ID, projectId: PROJECT_ID, targetBoqId: BOQ_ID, industry, frozenSources });
      const draft = assembleAutonomousBoqDraft({
        operation,
        industry,
        frozenSources,
        candidates: [fixture.measurement],
        unsupportedScopes: [{
          scopeId: `${engineId}-${capability}`,
          capability,
          description: `${capability} shown on source but no registered deterministic formula exists`,
          evidence: fixture.measurement.evidence,
        }],
        evaluatedAt: EVALUATED_AT,
      });
      expect(draft.exceptions).toContainEqual(expect.objectContaining({ code, capability, blocking: true, evidence: fixture.measurement.evidence }));
      expect(draft.completion).toMatchObject({ technicalComplete: false, readyForRates: false, onlyRatesBlock: false });
    },
  );

  it("preserves system validation and the original deterministic quantity through deliberate audited overrides", () => {
    const systemItem = assembleFixture(REPRESENTATIVE_INDUSTRY_FIXTURES[0]).items[0];
    const first = applyManualQuantityOverride(systemItem, {
      quantity: 6.25,
      reason: "Signed structural addendum increases footing depth.",
      actorUserId: "40000000-0000-4000-8000-000000000001",
      actorName: "Senior QS",
      overriddenAt: "2026-09-02T09:00:00.000Z",
    });
    expect(first.quantityValidation).toMatchObject({
      mode: "MANUAL_OVERRIDE",
      originalSystemQuantity: 6,
      previousQuantity: 6,
      reason: "Signed structural addendum increases footing depth.",
      actorUserId: "40000000-0000-4000-8000-000000000001",
    });

    const second = applyManualQuantityOverride(first, {
      quantity: 6.5,
      reason: "Approved R02 detail supersedes the addendum.",
      actorUserId: "40000000-0000-4000-8000-000000000001",
      actorName: "Senior QS",
      overriddenAt: "2026-09-02T10:00:00.000Z",
    });
    expect(second.quantityValidation).toMatchObject({ mode: "MANUAL_OVERRIDE", originalSystemQuantity: 6, previousQuantity: 6.25 });
    expect(() => applyManualQuantityOverride(systemItem, {
      quantity: 6.25,
      reason: "   ",
      actorUserId: "40000000-0000-4000-8000-000000000001",
      actorName: "Senior QS",
      overriddenAt: "2026-09-02T09:00:00.000Z",
    })).toThrow(/reason/i);
  });
});
