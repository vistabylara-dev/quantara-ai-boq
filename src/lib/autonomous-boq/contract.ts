import { createHash } from "node:crypto";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";

export const AUTONOMOUS_BOQ_CONTRACT_VERSION = "autonomous-boq/v1" as const;
export const AUTONOMOUS_POLICY_VERSION = "autonomous-industry-policy/v1" as const;
export const AUTONOMOUS_SYSTEM_ACTOR = "Quantara Autonomous Measurement" as const;

export type AutonomousIndustryEngineId =
  | "construction"
  | "interior-fitout"
  | "furniture"
  | "mep"
  | "electrical"
  | "hvac"
  | "plumbing"
  | "firefighting"
  | "joinery"
  | "landscaping";

export type AutonomousAssemblyMode = "GENERIC_POLICY" | "SPECIALIZED_JOINERY";

export type AutonomousPolicyRule = {
  id: string;
  sectionId: string;
  calculationType: import("@prisma/client").QuantityCalculationType;
  boqUnit: string;
  label: string;
  declaredCapabilities: readonly string[];
};

export type AutonomousUnsupportedCapabilityCode =
  | "UNSUPPORTED_DESIGN_SIZING"
  | "UNSUPPORTED_DESIGN_SELECTION"
  | "UNREGISTERED_MEASUREMENT_FORMULA"
  | "SPECIALIZED_ENGINE_REQUIRED";

export type AutonomousUnsupportedCapability = {
  capability: string;
  code: AutonomousUnsupportedCapabilityCode;
  reason: string;
};

export type AutonomousIndustryPolicy = {
  engineId: AutonomousIndustryEngineId;
  policyVersion: typeof AUTONOMOUS_POLICY_VERSION;
  assemblyMode: AutonomousAssemblyMode;
  rules: readonly AutonomousPolicyRule[];
  unsupportedCapabilities: readonly AutonomousUnsupportedCapability[];
};

export type AutonomousIndustryContext = {
  requestedIndustry: string;
  engineId: AutonomousIndustryEngineId;
  engineConfigHash: string;
  policyHash: string;
  policyVersion: typeof AUTONOMOUS_POLICY_VERSION;
  allowedRuleIds: readonly string[];
  policy: AutonomousIndustryPolicy;
  scopeNote: string;
};

export type FrozenAutonomousSourceInput = {
  fileId: string;
  checksumSha256: string;
  drawingIdentity: string;
  revision: string;
  pageIds: readonly string[];
};

export type FrozenAutonomousSource = {
  fileId: string;
  checksumSha256: string;
  drawingIdentity: string;
  revision: string;
  pageIds: readonly string[];
};

export type FrozenAutonomousSourceScope = {
  scopeHash: string;
  sources: readonly FrozenAutonomousSource[];
};

export type AutonomousOperationIdentity = {
  contractVersion: typeof AUTONOMOUS_BOQ_CONTRACT_VERSION;
  operationHash: string;
  companyId: string;
  projectId: string;
  targetBoqId: string;
  engineId: AutonomousIndustryEngineId;
  engineConfigHash: string;
  policyHash: string;
  policyVersion: typeof AUTONOMOUS_POLICY_VERSION;
  sourceScopeHash: string;
};

export type AutonomousEvidenceReference = {
  evidenceId: string;
  sourceFileId: string;
  pageId: string;
  role: "PRIMARY" | "SUPPORTING";
  reference: string;
};

export type AutonomousMeasurementCandidate = {
  candidateId: string;
  subjectKey: string;
  ruleId: string;
  description: string;
  formulaInputs: Readonly<Record<string, number>>;
  evidence: readonly AutonomousEvidenceReference[];
  reconciliation: {
    status: "DIRECT" | "RECONCILED" | "CONFLICT";
    evidenceIds: readonly string[];
  };
};

export type AutonomousUnsupportedScope = {
  scopeId: string;
  capability: string;
  description: string;
  evidence: readonly AutonomousEvidenceReference[];
};

export type AutonomousDomainExceptionCode =
  | AutonomousUnsupportedCapabilityCode
  | "DUPLICATE_MEASUREMENT_CONFLICT"
  | "EVIDENCE_OUTSIDE_FROZEN_SCOPE"
  | "PRIMARY_EVIDENCE_REQUIRED"
  | "REVISION_CONFLICT"
  | "RECONCILIATION_REQUIRED"
  | "RECONCILIATION_CONFLICT"
  | "POLICY_RULE_NOT_ALLOWED"
  | "FORMULA_INPUT_INVALID"
  | "NON_POSITIVE_QUANTITY"
  | "UNSUPPORTED_RESULT_UNIT";

export type AutonomousDomainException = {
  exceptionId: string;
  code: AutonomousDomainExceptionCode;
  blocking: true;
  subjectKey: string | null;
  capability: string | null;
  message: string;
  evidence: readonly AutonomousEvidenceReference[];
};

export type AutonomousSystemQuantityValidation = {
  mode: "SYSTEM_VALIDATED";
  actorUserId: null;
  actorName: typeof AUTONOMOUS_SYSTEM_ACTOR;
  validatedAt: string;
  calculationFingerprint: string;
  originalSystemQuantity: number;
};

export type AutonomousManualQuantityOverride = {
  mode: "MANUAL_OVERRIDE";
  actorUserId: string;
  actorName: string;
  overriddenAt: string;
  calculationFingerprint: string;
  originalSystemQuantity: number;
  previousQuantity: number;
  reason: string;
};

export type AutonomousBoqDraftItem = {
  itemFingerprint: string;
  subjectKey: string;
  sectionId: string;
  ruleId: string;
  description: string;
  quantity: number;
  unit: string;
  rate: 0;
  amount: 0;
  calculation: FormulaResult & {
    sourceResultUnit: string;
  };
  evidence: readonly AutonomousEvidenceReference[];
  quantityValidation: AutonomousSystemQuantityValidation | AutonomousManualQuantityOverride;
  rateValidation: { mode: "AWAITING_USER_RATE" };
};

export type AutonomousDraftCompletion = {
  technicalComplete: boolean;
  readyForRates: boolean;
  readyToFinalizeUnpriced: boolean;
  pricingOptional: boolean;
  /** Deprecated compatibility field. Rates are no longer a finalization blocker. */
  onlyRatesBlock: boolean;
  blockers: readonly string[];
};

export type AutonomousBoqDraft = {
  contractVersion: typeof AUTONOMOUS_BOQ_CONTRACT_VERSION;
  operationHash: string;
  industry: AutonomousIndustryContext;
  frozenSourceScopeHash: string;
  items: readonly AutonomousBoqDraftItem[];
  exceptions: readonly AutonomousDomainException[];
  deduplicatedCandidateIds: readonly string[];
  completion: AutonomousDraftCompletion;
};

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  throw new Error(`Cannot hash non-JSON contract value of type ${typeof value}.`);
}

export function stableAutonomousHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalValue(value)), "utf8").digest("hex");
}

export function freezeAutonomousSources(inputs: readonly FrozenAutonomousSourceInput[]): FrozenAutonomousSourceScope {
  if (inputs.length === 0) throw new Error("At least one finalized drawing source is required.");
  const byFileId = new Map<string, FrozenAutonomousSource>();

  for (const input of inputs) {
    const checksumSha256 = input.checksumSha256.toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(checksumSha256)) throw new Error(`Source ${input.fileId} requires a complete SHA-256 checksum.`);
    if (!input.drawingIdentity.trim() || !input.revision.trim()) throw new Error(`Source ${input.fileId} requires drawing identity and revision.`);
    const pageIds = [...new Set(input.pageIds.map((pageId) => pageId.trim()).filter(Boolean))].sort();
    if (pageIds.length === 0) throw new Error(`Source ${input.fileId} requires at least one frozen drawing page.`);
    const normalized: FrozenAutonomousSource = {
      fileId: input.fileId,
      checksumSha256,
      drawingIdentity: input.drawingIdentity.trim(),
      revision: input.revision.trim(),
      pageIds,
    };
    const existing = byFileId.get(input.fileId);
    if (existing && stableAutonomousHash(existing) !== stableAutonomousHash(normalized)) {
      throw new Error(`Conflicting frozen identity for source ${input.fileId}.`);
    }
    byFileId.set(input.fileId, normalized);
  }

  const sources = [...byFileId.values()].sort((left, right) => left.fileId.localeCompare(right.fileId));
  return {
    sources,
    scopeHash: stableAutonomousHash({ contractVersion: AUTONOMOUS_BOQ_CONTRACT_VERSION, sources }),
  };
}

export function buildAutonomousOperationIdentity(input: {
  companyId: string;
  projectId: string;
  targetBoqId: string;
  industry: AutonomousIndustryContext;
  frozenSources: FrozenAutonomousSourceScope;
}): AutonomousOperationIdentity {
  const identity = {
    contractVersion: AUTONOMOUS_BOQ_CONTRACT_VERSION,
    companyId: input.companyId,
    projectId: input.projectId,
    targetBoqId: input.targetBoqId,
    engineId: input.industry.engineId,
    requestedIndustry: input.industry.requestedIndustry,
    engineConfigHash: input.industry.engineConfigHash,
    policyHash: input.industry.policyHash,
    policyVersion: input.industry.policyVersion,
    allowedRuleIds: [...input.industry.allowedRuleIds].sort(),
    sourceScopeHash: input.frozenSources.scopeHash,
    sources: input.frozenSources.sources,
  };
  return {
    contractVersion: AUTONOMOUS_BOQ_CONTRACT_VERSION,
    operationHash: stableAutonomousHash(identity),
    companyId: input.companyId,
    projectId: input.projectId,
    targetBoqId: input.targetBoqId,
    engineId: input.industry.engineId,
    engineConfigHash: input.industry.engineConfigHash,
    policyHash: input.industry.policyHash,
    policyVersion: input.industry.policyVersion,
    sourceScopeHash: input.frozenSources.scopeHash,
  };
}

export function applyManualQuantityOverride(
  item: AutonomousBoqDraftItem,
  override: {
    quantity: number;
    reason: string;
    actorUserId: string;
    actorName: string;
    overriddenAt: string;
  },
): AutonomousBoqDraftItem {
  if (!Number.isFinite(override.quantity) || override.quantity <= 0) throw new Error("Override quantity must be a positive finite number.");
  const reason = override.reason.trim();
  if (!reason) throw new Error("A deliberate quantity override requires a reason.");
  if (!override.actorUserId.trim() || !override.actorName.trim()) throw new Error("A deliberate quantity override requires an accountable user.");
  const originalSystemQuantity = item.quantityValidation.originalSystemQuantity;
  return {
    ...item,
    quantity: override.quantity,
    amount: 0,
    quantityValidation: {
      mode: "MANUAL_OVERRIDE",
      actorUserId: override.actorUserId,
      actorName: override.actorName.trim(),
      overriddenAt: override.overriddenAt,
      calculationFingerprint: item.quantityValidation.calculationFingerprint,
      originalSystemQuantity,
      previousQuantity: item.quantity,
      reason,
    },
  };
}
