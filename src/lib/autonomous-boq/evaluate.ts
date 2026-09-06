import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import {
  AUTONOMOUS_BOQ_CONTRACT_VERSION,
  AUTONOMOUS_SYSTEM_ACTOR,
  stableAutonomousHash,
  type AutonomousBoqDraft,
  type AutonomousBoqDraftItem,
  type AutonomousDomainException,
  type AutonomousDomainExceptionCode,
  type AutonomousEvidenceReference,
  type AutonomousIndustryContext,
  type AutonomousMeasurementCandidate,
  type AutonomousOperationIdentity,
  type AutonomousUnsupportedScope,
  type FrozenAutonomousSourceScope,
} from "./contract";

type AssembleAutonomousBoqDraftInput = {
  operation: AutonomousOperationIdentity;
  industry: AutonomousIndustryContext;
  frozenSources: FrozenAutonomousSourceScope;
  candidates: readonly AutonomousMeasurementCandidate[];
  unsupportedScopes: readonly AutonomousUnsupportedScope[];
  evaluatedAt: string;
};

function exception(input: {
  code: AutonomousDomainExceptionCode;
  subjectKey?: string | null;
  capability?: string | null;
  message: string;
  evidence: readonly AutonomousEvidenceReference[];
}): AutonomousDomainException {
  const normalized = {
    code: input.code,
    subjectKey: input.subjectKey ?? null,
    capability: input.capability ?? null,
    message: input.message,
    evidence: [...input.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
  return { exceptionId: stableAutonomousHash(normalized), blocking: true, ...normalized };
}

function candidateIdentity(candidate: AutonomousMeasurementCandidate): string {
  return stableAutonomousHash({
    subjectKey: candidate.subjectKey,
    ruleId: candidate.ruleId,
    description: candidate.description,
    formulaInputs: candidate.formulaInputs,
    evidence: [...candidate.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    reconciliation: {
      status: candidate.reconciliation.status,
      evidenceIds: [...candidate.reconciliation.evidenceIds].sort(),
    },
  });
}

function evidenceException(
  candidate: AutonomousMeasurementCandidate,
  frozenSources: FrozenAutonomousSourceScope,
): AutonomousDomainException | null {
  const sourceById = new Map(frozenSources.sources.map((source) => [source.fileId, source]));
  if (candidate.evidence.length === 0 || !candidate.evidence.some((evidence) => evidence.role === "PRIMARY")) {
    return exception({
      code: "PRIMARY_EVIDENCE_REQUIRED",
      subjectKey: candidate.subjectKey,
      message: "A system-validated quantity requires at least one primary drawing evidence reference.",
      evidence: candidate.evidence,
    });
  }

  for (const evidence of candidate.evidence) {
    const source = sourceById.get(evidence.sourceFileId);
    if (!source || !source.pageIds.includes(evidence.pageId)) {
      return exception({
        code: "EVIDENCE_OUTSIDE_FROZEN_SCOPE",
        subjectKey: candidate.subjectKey,
        message: `Evidence ${evidence.evidenceId} is outside the frozen source/page scope.`,
        evidence: candidate.evidence,
      });
    }
  }

  const revisionsByDrawing = new Map<string, Set<string>>();
  for (const evidence of candidate.evidence) {
    const source = sourceById.get(evidence.sourceFileId)!;
    const revisions = revisionsByDrawing.get(source.drawingIdentity) ?? new Set<string>();
    revisions.add(source.revision);
    revisionsByDrawing.set(source.drawingIdentity, revisions);
  }
  if ([...revisionsByDrawing.values()].some((revisions) => revisions.size > 1)) {
    return exception({
      code: "REVISION_CONFLICT",
      subjectKey: candidate.subjectKey,
      message: "One measurement cannot mix revisions of the same drawing identity.",
      evidence: candidate.evidence,
    });
  }

  if (candidate.reconciliation.status === "CONFLICT") {
    return exception({
      code: "RECONCILIATION_CONFLICT",
      subjectKey: candidate.subjectKey,
      message: "Drawing and schedule evidence disagree and require resolution.",
      evidence: candidate.evidence,
    });
  }
  const citedSourceCount = new Set(candidate.evidence.map((evidence) => evidence.sourceFileId)).size;
  const citedEvidence = [...new Set(candidate.evidence.map((evidence) => evidence.evidenceId))].sort();
  const reconciledEvidence = [...new Set(candidate.reconciliation.evidenceIds)].sort();
  if (citedSourceCount > 1 && (
    candidate.reconciliation.status !== "RECONCILED"
    || stableAutonomousHash(citedEvidence) !== stableAutonomousHash(reconciledEvidence)
  )) {
    return exception({
      code: "RECONCILIATION_REQUIRED",
      subjectKey: candidate.subjectKey,
      message: "Every cited cross-source evidence record must be explicitly reconciled.",
      evidence: candidate.evidence,
    });
  }
  return null;
}

function isCompatibleUnit(sourceUnit: string, boqUnit: string): boolean {
  if (sourceUnit === boqUnit) return true;
  if (sourceUnit === "m" && boqUnit === "lm") return true;
  return sourceUnit === "nr" && ["nos", "pcs", "sets", "units", "points"].includes(boqUnit);
}

function candidateToItem(
  candidate: AutonomousMeasurementCandidate,
  input: AssembleAutonomousBoqDraftInput,
): { item?: AutonomousBoqDraftItem; error?: AutonomousDomainException } {
  const rule = input.industry.policy.rules.find((candidateRule) => candidateRule.id === candidate.ruleId);
  if (!rule || !input.industry.allowedRuleIds.includes(candidate.ruleId)) {
    return { error: exception({ code: "POLICY_RULE_NOT_ALLOWED", subjectKey: candidate.subjectKey, message: `Rule ${candidate.ruleId} is outside the selected industry policy.`, evidence: candidate.evidence }) };
  }
  const definition = getRequiredDimensions(rule.calculationType);
  if (!definition) {
    return { error: exception({ code: "FORMULA_INPUT_INVALID", subjectKey: candidate.subjectKey, message: `No registered deterministic formula exists for ${rule.calculationType}.`, evidence: candidate.evidence }) };
  }
  for (const [key, value] of Object.entries(candidate.formulaInputs)) {
    if (!Number.isFinite(value) || value < 0) {
      return { error: exception({ code: "FORMULA_INPUT_INVALID", subjectKey: candidate.subjectKey, message: `Formula input ${key} must be a finite non-negative number.`, evidence: candidate.evidence }) };
    }
  }
  for (const integerKey of ["verifiedCount", "faces", "coats"]) {
    const value = candidate.formulaInputs[integerKey];
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
      return { error: exception({ code: "FORMULA_INPUT_INVALID", subjectKey: candidate.subjectKey, message: `Formula input ${integerKey} must be a positive integer.`, evidence: candidate.evidence }) };
    }
  }

  let formula;
  try {
    formula = definition.compute({ ...candidate.formulaInputs });
  } catch (error) {
    return { error: exception({
      code: "FORMULA_INPUT_INVALID",
      subjectKey: candidate.subjectKey,
      message: error instanceof Error ? error.message : "The registered formula rejected its inputs.",
      evidence: candidate.evidence,
    }) };
  }
  if (!Number.isFinite(formula.resultValue) || formula.resultValue <= 0) {
    return { error: exception({ code: "NON_POSITIVE_QUANTITY", subjectKey: candidate.subjectKey, message: "A BOQ quantity must be a positive finite number.", evidence: candidate.evidence }) };
  }
  if (!isCompatibleUnit(formula.resultUnit, rule.boqUnit)) {
    return { error: exception({ code: "UNSUPPORTED_RESULT_UNIT", subjectKey: candidate.subjectKey, message: `Registered result unit ${formula.resultUnit} cannot become policy unit ${rule.boqUnit}.`, evidence: candidate.evidence }) };
  }

  const calculationFingerprint = stableAutonomousHash({
    contractVersion: AUTONOMOUS_BOQ_CONTRACT_VERSION,
    operationHash: input.operation.operationHash,
    subjectKey: candidate.subjectKey,
    ruleId: rule.id,
    formula: formula.formula,
    formulaInputs: formula.inputValues,
    quantity: formula.resultValue,
    unit: rule.boqUnit,
    evidence: candidate.evidence,
  });
  return { item: {
    itemFingerprint: stableAutonomousHash({ calculationFingerprint, sectionId: rule.sectionId }),
    subjectKey: candidate.subjectKey,
    sectionId: rule.sectionId,
    ruleId: rule.id,
    description: candidate.description.trim(),
    quantity: formula.resultValue,
    unit: rule.boqUnit,
    rate: 0,
    amount: 0,
    calculation: { ...formula, sourceResultUnit: formula.resultUnit, resultUnit: rule.boqUnit },
    evidence: candidate.evidence,
    quantityValidation: {
      mode: "SYSTEM_VALIDATED",
      actorUserId: null,
      actorName: AUTONOMOUS_SYSTEM_ACTOR,
      validatedAt: input.evaluatedAt,
      calculationFingerprint,
      originalSystemQuantity: formula.resultValue,
    },
    rateValidation: { mode: "AWAITING_USER_RATE" },
  } };
}

export function assembleAutonomousBoqDraft(input: AssembleAutonomousBoqDraftInput): AutonomousBoqDraft {
  if (input.operation.contractVersion !== AUTONOMOUS_BOQ_CONTRACT_VERSION
    || input.operation.engineId !== input.industry.engineId
    || input.operation.engineConfigHash !== input.industry.engineConfigHash
    || input.operation.policyHash !== input.industry.policyHash
    || input.operation.policyVersion !== input.industry.policyVersion
    || input.operation.sourceScopeHash !== input.frozenSources.scopeHash) {
    throw new Error("Autonomous BOQ operation identity does not match its frozen industry/source context.");
  }

  const exceptions: AutonomousDomainException[] = [];
  const deduplicatedCandidateIds: string[] = [];
  const selectedCandidates: AutonomousMeasurementCandidate[] = [];
  const bySubject = new Map<string, AutonomousMeasurementCandidate[]>();
  for (const candidate of input.candidates) {
    const group = bySubject.get(candidate.subjectKey) ?? [];
    group.push(candidate);
    bySubject.set(candidate.subjectKey, group);
  }

  for (const [subjectKey, candidates] of bySubject) {
    const identities = new Set(candidates.map(candidateIdentity));
    if (identities.size > 1) {
      exceptions.push(exception({
        code: "DUPLICATE_MEASUREMENT_CONFLICT",
        subjectKey,
        message: "Duplicate measurement subjects disagree on formula inputs, evidence, or reconciliation.",
        evidence: candidates.flatMap((candidate) => candidate.evidence),
      }));
      continue;
    }
    selectedCandidates.push(candidates[0]);
    deduplicatedCandidateIds.push(...candidates.slice(1).map((candidate) => candidate.candidateId));
  }

  const items: AutonomousBoqDraftItem[] = [];
  for (const candidate of selectedCandidates) {
    const evidenceError = evidenceException(candidate, input.frozenSources);
    if (evidenceError) {
      exceptions.push(evidenceError);
      continue;
    }
    const evaluated = candidateToItem(candidate, input);
    if (evaluated.error) exceptions.push(evaluated.error);
    if (evaluated.item) items.push(evaluated.item);
  }

  for (const scope of input.unsupportedScopes) {
    const policyCapability = input.industry.policy.unsupportedCapabilities.find((candidate) => candidate.capability === scope.capability);
    exceptions.push(exception({
      code: policyCapability?.code ?? "UNREGISTERED_MEASUREMENT_FORMULA",
      capability: scope.capability,
      message: policyCapability?.reason ?? scope.description,
      evidence: scope.evidence,
    }));
  }

  const sortedExceptions = exceptions.sort((left, right) => left.exceptionId.localeCompare(right.exceptionId));
  const sortedItems = items.sort((left, right) => left.itemFingerprint.localeCompare(right.itemFingerprint));
  const technicalComplete = sortedItems.length > 0 && sortedExceptions.length === 0;
  const blockers = technicalComplete
    ? []
    : [...new Set(sortedExceptions.map((entry) => entry.code))].sort();

  return {
    contractVersion: AUTONOMOUS_BOQ_CONTRACT_VERSION,
    operationHash: input.operation.operationHash,
    industry: input.industry,
    frozenSourceScopeHash: input.frozenSources.scopeHash,
    items: sortedItems,
    exceptions: sortedExceptions,
    deduplicatedCandidateIds: deduplicatedCandidateIds.sort(),
    completion: {
      technicalComplete,
      readyForRates: technicalComplete,
      readyToFinalizeUnpriced: technicalComplete,
      pricingOptional: true,
      onlyRatesBlock: false,
      blockers,
    },
  };
}
