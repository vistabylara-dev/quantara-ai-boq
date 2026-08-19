import { createHash } from "node:crypto";
import {
  ExtractedEntityType,
  QuantityCalculationType,
} from "@prisma/client";
import { z } from "zod";
import {
  getRequiredDimensions,
  listSupportedCalculationTypes,
} from "@/lib/calculations/required-dimensions-registry";

export const TAYQAN_MEASUREMENT_VERSION = "tayqan-measurement-v3-autonomous-router" as const;
export const TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX = `${TAYQAN_MEASUREMENT_VERSION}:`;

export const TAYQAN_MEASUREMENT_EXCEPTION_KINDS = [
  "INSUFFICIENT_EVIDENCE",
  "SCALE_REQUIRED",
  "AMBIGUOUS_SCOPE",
  "CROSS_PAGE_CONFLICT",
  "UNSUPPORTED_FORMULA",
  "REVISION_CONFLICT",
  "PLAN_SCHEDULE_MISMATCH",
  "DOUBLE_COUNT_RISK",
  "SCOPE_GAP",
  "UNIT_OR_DIMENSION_ANOMALY",
  "STANDARD_RULE_UNAVAILABLE",
  "SPEC_DRAWING_CONFLICT",
  "METHOD_SELECTION_UNCERTAIN",
  "SUPPORTING_CHECK_MISMATCH",
  "COMPOSITE_SCOPE_REQUIRES_SPLIT",
] as const;

export const tayqanMeasurementExceptionKindSchema = z.enum(
  TAYQAN_MEASUREMENT_EXCEPTION_KINDS,
);

/**
 * PR1 correctness/completion-safety mission 2: exception kinds that describe
 * a genuine measurement-integrity risk, not just an informational note. A
 * work order may not proceed into BOQ_ASSEMBLY, complete VALIDATION, reach
 * READY_FOR_ACCEPTANCE, or be accepted while any of these is unresolved.
 *
 * The suggested minimum from the mission brief is REVISION_CONFLICT,
 * PLAN_SCHEDULE_MISMATCH, METHOD_SELECTION_UNCERTAIN,
 * SUPPORTING_CHECK_MISMATCH, and COMPOSITE_SCOPE_REQUIRES_SPLIT. SCOPE_GAP is
 * added here: mission 1 closes the raw-extraction bypass by turning an
 * ungrounded quantity into a SCOPE_GAP exception instead of a fabricated BOQ
 * row, and if SCOPE_GAP were only informational, a work order could still
 * sail to acceptance with scope items that were never genuinely measured —
 * exactly the "completion safety" failure this PR exists to close.
 *
 * TAYQAN-AUDIT-FIX-1 adds three more, each backed by evidence gathered from
 * openai-tayqan-measurement-reasoner.ts's actual prompt instructions before
 * adding it, not by guessing:
 * - SPEC_DRAWING_CONFLICT already had an explicit single-condition trigger
 *   instruction ("If specification notes and drawing evidence materially
 *   conflict, create SPEC_DRAWING_CONFLICT") — the exact same phrasing
 *   pattern already used for PLAN_SCHEDULE_MISMATCH/REVISION_CONFLICT, both
 *   already dangerous with no reported over-blocking. No prompt change was
 *   needed for this one.
 * - DOUBLE_COUNT_RISK and UNIT_OR_DIMENSION_ANOMALY had NO explicit trigger
 *   instruction at all before this fix (confirmed by reading the full
 *   reasoner prompt — only a general "don't double-count" instruction with
 *   no exception-raising trigger, and no mention of unit/dimension anomalies
 *   whatsoever), so there was no prompt-level mechanism that could have made
 *   either fire frequently — no evidence of an over-blocking risk. Both name
 *   a genuine, serious measurement-integrity concern (an inflated payable
 *   quantity; an order-of-magnitude/unit error), so per the mission's
 *   default-to-add guidance they're added here, and openai-tayqan-
 *   measurement-reasoner.ts gained one trigger instruction each (mirroring
 *   the existing PLAN_SCHEDULE_MISMATCH/SPEC_DRAWING_CONFLICT phrasing) so
 *   the model reliably raises them now that they gate.
 *
 * CROSS_PAGE_CONFLICT is deliberately left informational: it is the
 * broadest, most general-purpose "evidence disagrees" signal of the four
 * candidates considered, has no explicit trigger instruction in the prompt
 * either, and structurally overlaps every other, more specific conflict
 * kind already listed (REVISION_CONFLICT, PLAN_SCHEDULE_MISMATCH,
 * SPEC_DRAWING_CONFLICT, SUPPORTING_CHECK_MISMATCH). Its breadth makes it
 * the one candidate most likely to become a catch-all a model reaches for on
 * minor, non-blocking discrepancies if it were ever prompted to raise it —
 * with no usage data available to confirm otherwise, this is a judgment
 * call left for the product owner rather than a guess in either direction.
 *
 * All other kinds remain informational (visible, not blocking) by default.
 */
export const TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS = new Set<
  (typeof TAYQAN_MEASUREMENT_EXCEPTION_KINDS)[number]
>([
  "REVISION_CONFLICT",
  "PLAN_SCHEDULE_MISMATCH",
  "METHOD_SELECTION_UNCERTAIN",
  "SUPPORTING_CHECK_MISMATCH",
  "COMPOSITE_SCOPE_REQUIRES_SPLIT",
  "SCOPE_GAP",
  "SPEC_DRAWING_CONFLICT",
  "DOUBLE_COUNT_RISK",
  "UNIT_OR_DIMENSION_ANOMALY",
]);

export function tayqanMeasurementExceptionIsDangerous(kind: string): boolean {
  return TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS.has(
    kind as (typeof TAYQAN_MEASUREMENT_EXCEPTION_KINDS)[number],
  );
}

/**
 * Stable, content-addressable identity for a measurement exception so the
 * same underlying gap is never recorded twice in the work order's exception
 * ledger, and so an engineer's resolution survives the ledger being
 * re-derived on a later advance pass.
 */
export function tayqanMeasurementExceptionKey(exception: {
  kind: string;
  message: string;
  pageIds: readonly string[];
  relatedEntityId?: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: exception.kind,
        message: exception.message.trim(),
        pageIds: [...exception.pageIds].sort(),
        relatedEntityId: exception.relatedEntityId ?? null,
      }),
    )
    .digest("hex")
    .slice(0, 20);
}

export const TAYQAN_MEASUREMENT_METHODS = [
  "COUNT",
  "LINEAR",
  "AREA",
  "VOLUME",
  "WEIGHT",
] as const;

export const tayqanMeasurementMethodSchema = z.enum(
  TAYQAN_MEASUREMENT_METHODS,
);

export type TayqanMeasurementMethod = z.infer<
  typeof tayqanMeasurementMethodSchema
>;

const CALCULATION_METHOD_BY_TYPE: Readonly<
  Partial<Record<QuantityCalculationType, TayqanMeasurementMethod>>
> = {
  [QuantityCalculationType.COUNT]: "COUNT",
  [QuantityCalculationType.SKIRTING_LENGTH]: "LINEAR",
  [QuantityCalculationType.PIPE_LENGTH]: "LINEAR",
  [QuantityCalculationType.CABLE_LENGTH]: "LINEAR",
  [QuantityCalculationType.FLOOR_AREA]: "AREA",
  [QuantityCalculationType.CEILING_AREA]: "AREA",
  [QuantityCalculationType.WALL_AREA]: "AREA",
  [QuantityCalculationType.PAINT_AREA]: "AREA",
  [QuantityCalculationType.PARTITION_AREA]: "AREA",
  [QuantityCalculationType.DUCT_SURFACE_AREA]: "AREA",
  [QuantityCalculationType.FORMWORK_AREA]: "AREA",
  [QuantityCalculationType.CONCRETE_VOLUME]: "VOLUME",
  [QuantityCalculationType.EXCAVATION_VOLUME]: "VOLUME",
  [QuantityCalculationType.REINFORCEMENT_WEIGHT]: "WEIGHT",
};

export function tayqanMeasurementMethodForCalculationType(
  calculationType: QuantityCalculationType,
): TayqanMeasurementMethod | null {
  return CALCULATION_METHOD_BY_TYPE[calculationType] ?? null;
}

export const tayqanMeasurementDerivationSchema = z.enum([
  "EXPLICIT_DIMENSION",
  "SCHEDULE_VALUE",
  "DIRECT_COUNT",
  "COUNT_RECONCILIATION",
  "ROOM_GEOMETRY",
  "VERIFIED_SCALE_GEOMETRY",
]);

export type TayqanMeasurementDerivation = z.infer<
  typeof tayqanMeasurementDerivationSchema
>;

export const tayqanMeasurementInputSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.number().finite().min(0),
  unit: z.string().trim().min(1).max(24).nullable(),
  derivation: tayqanMeasurementDerivationSchema,
  evidencePageIds: z.array(z.string().uuid()).min(1).max(8),
  evidenceRoomIds: z.array(z.string().uuid()).max(8),
  evidenceNote: z.string().trim().min(1).max(500),
  confidence: z.number().finite().min(0).max(100),
}).strict();

export const tayqanSupportingMeasurementCheckSchema = z.object({
  application: z.enum(["CROSS_CHECK", "REPETITION_MULTIPLIER"]),
  measurementMethod: tayqanMeasurementMethodSchema,
  calculationType: z.nativeEnum(QuantityCalculationType),
  inputs: z.array(tayqanMeasurementInputSchema).min(1).max(16),
  rationale: z.string().trim().min(1).max(1_200),
  confidence: z.number().finite().min(0).max(100),
}).strict();

export type TayqanSupportingMeasurementCheck = z.infer<
  typeof tayqanSupportingMeasurementCheckSchema
>;

export const tayqanMeasurementSubjectSchema = z.object({
  existingEntityId: z.string().uuid().nullable(),
  primaryPageId: z.string().uuid(),
  evidencePageIds: z.array(z.string().uuid()).min(1).max(16),
  entityType: z.nativeEnum(ExtractedEntityType),
  label: z.string().trim().min(1).max(240),
  workPackage: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160).nullable(),
  measurementMethod: tayqanMeasurementMethodSchema,
  methodSelectionRationale: z.string().trim().min(1).max(1_500),
  methodConfidence: z.number().finite().min(0).max(100),
  calculationType: z.nativeEnum(QuantityCalculationType),
  inputs: z.array(tayqanMeasurementInputSchema).min(1).max(16),
  supportingChecks: z.array(tayqanSupportingMeasurementCheckSchema).max(6),
  rationale: z.string().trim().min(1).max(2_000),
  sourceSummary: z.string().trim().min(1).max(2_000),
  confidence: z.number().finite().min(0).max(100),
}).strict();

export const tayqanMeasurementExceptionSchema = z.object({
  kind: tayqanMeasurementExceptionKindSchema,
  message: z.string().trim().min(1).max(1_500),
  pageIds: z.array(z.string().uuid()).max(16),
  relatedEntityId: z.string().uuid().nullable(),
}).strict();

export const tayqanMeasurementPlanSchema = z.object({
  subjects: z.array(tayqanMeasurementSubjectSchema).max(3_000),
  exceptions: z.array(tayqanMeasurementExceptionSchema).max(3_000),
}).strict();

export type TayqanMeasurementInput = z.infer<typeof tayqanMeasurementInputSchema>;
export type TayqanMeasurementSubject = z.infer<typeof tayqanMeasurementSubjectSchema>;
export type TayqanMeasurementPlan = z.infer<typeof tayqanMeasurementPlanSchema>;
export type TayqanMeasurementException = z.infer<typeof tayqanMeasurementExceptionSchema>;

export type TayqanMeasurementPageGuard = {
  projectFileId: string;
  scaleVerified: boolean;
  drawingNumber: string | null;
  revisionNumber: string | null;
  role: string;
};

export type TayqanMeasurementRoomGuard = {
  scaleVerified: boolean;
};

export type TayqanMeasurementEvaluationContext = {
  allowedEntityIds: ReadonlySet<string>;
  roomsById: ReadonlyMap<string, TayqanMeasurementRoomGuard>;
  pagesById: ReadonlyMap<string, TayqanMeasurementPageGuard>;
};

export type EvaluatedTayqanMeasurement = {
  subject: TayqanMeasurementSubject;
  normalizedInputValues: Record<string, number>;
  formula: string;
  baseResultValue: number;
  repetitionMultiplier: number;
  resultValue: number;
  resultUnit: string;
  deductions: Record<string, number> | null;
  allowances: Record<string, number> | null;
  confidence: number;
  supportingChecks: Array<{
    application: "CROSS_CHECK" | "REPETITION_MULTIPLIER";
    measurementMethod: TayqanMeasurementMethod;
    calculationType: QuantityCalculationType;
    formula: string;
    resultValue: number;
    resultUnit: string;
    confidence: number;
    rationale: string;
  }>;
};

function canonicalUnit(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/\s+/g, "");

  const aliases: Record<string, string> = {
    metre: "m",
    meter: "m",
    metres: "m",
    meters: "m",
    mtr: "m",
    mtrs: "m",
    lm: "m",
    linearmetre: "m",
    linearmeter: "m",
    linearmetres: "m",
    linearmeters: "m",
    millimetre: "mm",
    millimeter: "mm",
    millimetres: "mm",
    millimeters: "mm",
    centimetre: "cm",
    centimeter: "cm",
    centimetres: "cm",
    centimeters: "cm",
    inch: "in",
    inches: "in",
    foot: "ft",
    feet: "ft",
    yard: "yd",
    yards: "yd",
    sqm: "m2",
    "sq.m": "m2",
    sqmeter: "m2",
    sqmetre: "m2",
    squaremeter: "m2",
    squaremetre: "m2",
    "m^2": "m2",
    "mm^2": "mm2",
    "cm^2": "cm2",
    sqft: "ft2",
    squarefoot: "ft2",
    squarefeet: "ft2",
    "ft^2": "ft2",
    sqin: "in2",
    "in^2": "in2",
    sqyd: "yd2",
    "yd^2": "yd2",
    cum: "m3",
    "cu.m": "m3",
    cubicmeter: "m3",
    cubicmetre: "m3",
    "m^3": "m3",
    "mm^3": "mm3",
    "cm^3": "cm3",
    cuft: "ft3",
    "ft^3": "ft3",
    cuin: "in3",
    "in^3": "in3",
    cuyd: "yd3",
    "yd^3": "yd3",
    number: "nr",
    no: "nr",
    nos: "nr",
    count: "nr",
    ea: "nr",
    each: "nr",
    pc: "nr",
    pcs: "nr",
    piece: "nr",
    pieces: "nr",
    item: "nr",
    items: "nr",
    percent: "%",
    percentage: "%",
    tonne: "t",
    tonnes: "t",
    ton: "t",
    tons: "t",
    pound: "lb",
    pounds: "lb",
    lbs: "lb",
  };

  return aliases[normalized] ?? normalized;
}

function convertByFactor(
  value: number,
  from: string,
  to: string,
  factorsToCanonical: Readonly<Record<string, number>>,
): number | null {
  const fromFactor = factorsToCanonical[from];
  const toFactor = factorsToCanonical[to];
  if (fromFactor === undefined || toFactor === undefined) return null;
  return value * fromFactor / toFactor;
}

function convertLinear(value: number, from: string, to: string): number | null {
  return convertByFactor(value, from, to, {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
  });
}

function convertArea(value: number, from: string, to: string): number | null {
  return convertByFactor(value, from, to, {
    mm2: 0.000001,
    cm2: 0.0001,
    m2: 1,
    in2: 0.00064516,
    ft2: 0.09290304,
    yd2: 0.83612736,
  });
}

function convertVolume(value: number, from: string, to: string): number | null {
  return convertByFactor(value, from, to, {
    mm3: 0.000000001,
    cm3: 0.000001,
    m3: 1,
    in3: 0.000016387064,
    ft3: 0.028316846592,
    yd3: 0.764554857984,
  });
}

export function normalizeTayqanMeasurementValue(
  value: number,
  sourceUnit: string | null,
  expectedUnit: string | null,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("TAYQAN measurement inputs must be finite, non-negative values.");
  }

  const expected = canonicalUnit(expectedUnit);
  const source = canonicalUnit(sourceUnit);

  if (expected === null) {
    if (source !== null && !["nr", "unit", "units"].includes(source)) {
      throw new Error(`Dimensionless input cannot consume source unit "${sourceUnit}".`);
    }
    return value;
  }

  if (source === null) {
    throw new Error(`A source unit is required for an input whose canonical unit is "${expectedUnit}".`);
  }

  if (source === expected) return value;

  const linear = convertLinear(value, source, expected);
  if (linear !== null) return linear;

  const area = convertArea(value, source, expected);
  if (area !== null) return area;

  const volume = convertVolume(value, source, expected);
  if (volume !== null) return volume;

  if (expected === "kg" && source === "g") return value / 1_000;
  if (expected === "kg" && source === "t") return value * 1_000;
  if (expected === "kg" && source === "lb") return value * 0.45359237;
  if (expected === "kg/m" && source === "g/m") return value / 1_000;
  if (expected === "%" && source === "%") return value;

  throw new Error(`Cannot normalize source unit "${sourceUnit}" to required unit "${expectedUnit}".`);
}

function integerInputKey(key: string): boolean {
  return ["verifiedCount", "faces", "coats"].includes(key);
}

/**
 * TAYQAN-AUDIT-FIX-1: the cap scales with how much of this derivation's
 * claim is independently checked by code below (the input-validation loop
 * in evaluateTayqanMeasurementSubject) versus taken purely on the model's
 * word. This is a ceiling on `confidence` (see the `Math.min(...)` in
 * evaluateTayqanMeasurementSubject) — a derivation the code cannot actually
 * verify must never be capable of reaching a higher confidence than one it
 * does. Three tiers, ordered by verification strength:
 *
 * 1. Scale-verified geometry — ROOM_GEOMETRY and VERIFIED_SCALE_GEOMETRY.
 *    Both require the cited record (a stored DetectedRoom or the evidence
 *    page itself) to carry `scaleVerified: true` — a real, independently
 *    computed calibration fact, not something this derivation's input can
 *    fake. Highest cap.
 * 2. Structurally cross-referenced — COUNT_RECONCILIATION. Code requires at
 *    least two independent evidence pages, a real (if weaker) check: it
 *    confirms multiple sources were actually cited, but not that their
 *    values agree or that either is scale-calibrated. Capped below tier 1,
 *    above tier 3.
 * 3. Self-declared — EXPLICIT_DIMENSION, SCHEDULE_VALUE, DIRECT_COUNT. Code
 *    only confirms the cited page exists in the frozen source scope, never
 *    that the claimed dimension/schedule value/count is actually present on
 *    it — this is purely a label the model assigns itself. Lowest tier,
 *    always below every code-verified derivation. DIRECT_COUNT sits at the
 *    bottom of this tier: a visual count is inherently more error-prone
 *    than a printed dimension or schedule value, if either is genuinely
 *    present (which the code still cannot confirm).
 *
 * Not yet possible to strengthen tier 3 with a real content check (e.g.
 * requiring EXPLICIT_DIMENSION to cite OCR'd page text containing a
 * plausible dimension pattern): the OCR'd `technicalLines` signal exists
 * upstream in tayqan-measurement-service.ts's page bundle but is not
 * currently threaded into `TayqanMeasurementPageGuard`/`pagesById`, and that
 * file is out of scope for this fix. Documented as future work rather than
 * attempted here — see the audit-fix-1 PR description.
 */
export function derivationConfidenceCap(derivation: TayqanMeasurementDerivation): number {
  switch (derivation) {
    case "ROOM_GEOMETRY":
    case "VERIFIED_SCALE_GEOMETRY":
      return 98;
    case "COUNT_RECONCILIATION":
      return 95;
    case "EXPLICIT_DIMENSION":
    case "SCHEDULE_VALUE":
      return 90;
    case "DIRECT_COUNT":
      return 88;
  }
}

/**
 * PR2 gap 3: prior behavior confirmed by reading every call site — this was
 * the ONLY caller (evaluateTayqanMeasurementSubject, below), invoked from a
 * plain .map() in tayqan-measurement-service.ts with no try/catch around
 * each subject. A plain Error here aborted the entire measurement pass with
 * an unhandled 500, not a visible, gating exception. Throwing this typed
 * error instead lets the caller catch specifically this failure per-subject
 * (skipping just that one subject) while every other thrown Error in
 * evaluateTayqanMeasurementSubject keeps aborting the pass exactly as
 * before — this class exists so the caller can distinguish "a real,
 * structured revision conflict" from "the AI's output was invalid," which
 * must never be silently downgraded into a soft exception.
 */
export class TayqanRevisionConflictError extends Error {
  constructor(readonly exception: TayqanMeasurementException) {
    super(exception.message);
    this.name = "TayqanRevisionConflictError";
  }
}

/**
 * Detection logic is unchanged from before PR2 — only the failure mode
 * changed, from throwing a plain Error (unhandled crash) to throwing
 * TayqanRevisionConflictError (caught per-subject by the caller and
 * recorded as a structured REVISION_CONFLICT measurement exception, which
 * PR1's TAYQAN_DANGEROUS_MEASUREMENT_EXCEPTION_KINDS already gates on).
 */
function assertNoRevisionMix(
  subject: { existingEntityId: string | null },
  evidencePageIds: readonly string[],
  pagesById: ReadonlyMap<string, TayqanMeasurementPageGuard>,
) {
  const revisionsByDrawing = new Map<string, Set<string>>();

  for (const pageId of evidencePageIds) {
    const page = pagesById.get(pageId);
    if (!page?.drawingNumber?.trim() || !page.revisionNumber?.trim()) continue;
    const drawingNumber = page.drawingNumber.trim().toUpperCase();
    const revisions = revisionsByDrawing.get(drawingNumber) ?? new Set<string>();
    revisions.add(page.revisionNumber.trim().toUpperCase());
    revisionsByDrawing.set(drawingNumber, revisions);
  }

  for (const [drawingNumber, revisions] of revisionsByDrawing) {
    if (revisions.size > 1) {
      throw new TayqanRevisionConflictError({
        kind: "REVISION_CONFLICT",
        message: `TAYQAN measurement mixed revisions of drawing ${drawingNumber}; resolve revision authority before measurement.`,
        pageIds: [...evidencePageIds],
        relatedEntityId: subject.existingEntityId,
      });
    }
  }
}

export function evaluateTayqanMeasurementSubject(
  rawSubject: unknown,
  context: TayqanMeasurementEvaluationContext,
): EvaluatedTayqanMeasurement {
  const subject = tayqanMeasurementSubjectSchema.parse(rawSubject);

  if (subject.existingEntityId && !context.allowedEntityIds.has(subject.existingEntityId)) {
    throw new Error("TAYQAN measurement referenced an extracted entity outside the frozen source scope.");
  }

  const primaryPage = context.pagesById.get(subject.primaryPageId);
  if (!primaryPage) {
    throw new Error("TAYQAN measurement referenced a primary page outside the frozen source scope.");
  }

  const subjectEvidencePageIds = new Set(subject.evidencePageIds);
  if (subjectEvidencePageIds.size !== subject.evidencePageIds.length) {
    throw new Error("TAYQAN measurement subject contains duplicate evidence page references.");
  }
  if (!subjectEvidencePageIds.has(subject.primaryPageId)) {
    throw new Error("TAYQAN measurement primary page must be included in the subject evidence set.");
  }

  for (const pageId of subject.evidencePageIds) {
    if (!context.pagesById.has(pageId)) {
      throw new Error("TAYQAN measurement referenced evidence outside the frozen source scope.");
    }
  }

  assertNoRevisionMix(subject, subject.evidencePageIds, context.pagesById);

  const expectedMeasurementMethod =
    tayqanMeasurementMethodForCalculationType(subject.calculationType);
  if (!expectedMeasurementMethod) {
    throw new Error(
      `TAYQAN selected a deterministic calculator with no autonomous measurement-method mapping: "${subject.calculationType}".`,
    );
  }
  if (subject.measurementMethod !== expectedMeasurementMethod) {
    throw new Error(
      `TAYQAN measurement method "${subject.measurementMethod}" does not match calculator "${subject.calculationType}" (${expectedMeasurementMethod}).`,
    );
  }

  const definition = getRequiredDimensions(subject.calculationType);
  if (!definition) {
    throw new Error(`TAYQAN selected unsupported deterministic calculation type "${subject.calculationType}".`);
  }

  const supported = new Set(listSupportedCalculationTypes());
  if (!supported.has(subject.calculationType)) {
    throw new Error(`TAYQAN selected a calculation type not registered for deterministic evaluation: "${subject.calculationType}".`);
  }

  const inputDefinitions = new Map(definition.inputs.map((input) => [input.key, input]));
  const normalizedInputValues: Record<string, number> = {};
  const seen = new Set<string>();
  const inputConfidences: number[] = [];
  const derivationCaps: number[] = [];

  for (const input of subject.inputs) {
    const definitionInput = inputDefinitions.get(input.key);
    if (!definitionInput) {
      throw new Error(`TAYQAN supplied unexpected input "${input.key}" for ${subject.calculationType}.`);
    }
    if (seen.has(input.key)) {
      throw new Error(`TAYQAN supplied duplicate input "${input.key}".`);
    }
    seen.add(input.key);

    if (new Set(input.evidencePageIds).size !== input.evidencePageIds.length) {
      throw new Error(`Input "${input.key}" contains duplicate evidence pages.`);
    }

    if (
      input.derivation === "COUNT_RECONCILIATION"
      && new Set(input.evidencePageIds).size < 2
    ) {
      throw new Error(`Input "${input.key}" claims reconciled count without at least two independent page references.`);
    }

    for (const roomId of input.evidenceRoomIds) {
      const room = context.roomsById.get(roomId);
      if (!room) {
        throw new Error(`Input "${input.key}" cites room geometry outside the frozen source scope.`);
      }
      if (input.derivation === "ROOM_GEOMETRY" && !room.scaleVerified) {
        throw new Error(`Input "${input.key}" attempted stored room geometry without a verified scale calibration.`);
      }
    }
    if (input.derivation === "ROOM_GEOMETRY" && input.evidenceRoomIds.length === 0) {
      throw new Error(`Input "${input.key}" claims room geometry without citing a stored room.`);
    }

    for (const pageId of input.evidencePageIds) {
      const page = context.pagesById.get(pageId);
      if (!page) {
        throw new Error(`Input "${input.key}" cites a page outside the frozen source scope.`);
      }
      if (!subjectEvidencePageIds.has(pageId)) {
        throw new Error(`Input "${input.key}" cites a page missing from the subject evidence set.`);
      }
      if (input.derivation === "VERIFIED_SCALE_GEOMETRY" && !page.scaleVerified) {
        throw new Error(`Input "${input.key}" attempted scaled geometry on an unverified drawing scale.`);
      }
    }

    const normalized = normalizeTayqanMeasurementValue(
      input.value,
      input.unit,
      definitionInput.unit,
    );

    if (integerInputKey(input.key) && !Number.isInteger(normalized)) {
      throw new Error(`Input "${input.key}" must be an integer.`);
    }

    normalizedInputValues[input.key] = normalized;
    inputConfidences.push(input.confidence);
    derivationCaps.push(derivationConfidenceCap(input.derivation));
  }

  for (const required of definition.inputs.filter((input) => input.required)) {
    if (normalizedInputValues[required.key] === undefined) {
      throw new Error(`TAYQAN did not provide required evidence-backed input "${required.key}".`);
    }
  }

  const computed = definition.compute(normalizedInputValues);
  if (!Number.isFinite(computed.resultValue) || computed.resultValue <= 0) {
    throw new Error("Deterministic TAYQAN formula returned a zero or invalid result; do not create an empty BOQ quantity.");
  }
  if (computed.resultUnit !== definition.resultUnit) {
    throw new Error("Deterministic TAYQAN formula returned an unexpected result unit.");
  }

  const confidence = Math.min(
    subject.confidence,
    subject.methodConfidence,
    ...(inputConfidences.length > 0 ? inputConfidences : [subject.confidence]),
    ...(derivationCaps.length > 0 ? derivationCaps : [subject.confidence]),
  );

  const supportingChecks = subject.supportingChecks.map((check) => {
    const expectedMethod =
      tayqanMeasurementMethodForCalculationType(check.calculationType);
    if (!expectedMethod || check.measurementMethod !== expectedMethod) {
      throw new Error(
        `TAYQAN supporting check method "${check.measurementMethod}" does not match calculator "${check.calculationType}".`,
      );
    }
    if (check.calculationType === subject.calculationType) {
      throw new Error(
        "TAYQAN supporting check cannot repeat the primary calculator; it must independently corroborate or deterministically repeat the payable quantity.",
      );
    }
    if (
      check.application === "REPETITION_MULTIPLIER"
      && (
        check.measurementMethod !== "COUNT"
        || check.calculationType !== QuantityCalculationType.COUNT
      )
    ) {
      throw new Error(
        "TAYQAN repetition multiplier must be an evidence-backed COUNT/COUNT calculation.",
      );
    }

    const evaluatedCheck = evaluateTayqanMeasurementSubject({
      ...subject,
      measurementMethod: check.measurementMethod,
      methodSelectionRationale: check.rationale,
      methodConfidence: check.confidence,
      calculationType: check.calculationType,
      inputs: check.inputs,
      supportingChecks: [],
      rationale: check.rationale,
      confidence: check.confidence,
    }, context);

    return {
      application: check.application,
      measurementMethod: check.measurementMethod,
      calculationType: check.calculationType,
      formula: evaluatedCheck.formula,
      resultValue: evaluatedCheck.resultValue,
      resultUnit: evaluatedCheck.resultUnit,
      confidence: evaluatedCheck.confidence,
      rationale: check.rationale,
    };
  });

  const uniqueSupportingChecks = new Set(
    supportingChecks.map((check) =>
      `${check.application}:${check.measurementMethod}:${check.calculationType}`),
  );
  if (uniqueSupportingChecks.size !== supportingChecks.length) {
    throw new Error("TAYQAN supplied duplicate supporting measurement checks.");
  }

  const repetitionChecks = supportingChecks.filter(
    (check) => check.application === "REPETITION_MULTIPLIER",
  );
  if (repetitionChecks.length > 1) {
    throw new Error("TAYQAN may apply at most one repetition multiplier to a payable measurement.");
  }
  const repetitionMultiplier = repetitionChecks[0]?.resultValue ?? 1;
  if (!Number.isInteger(repetitionMultiplier) || repetitionMultiplier <= 0) {
    throw new Error("TAYQAN repetition multiplier must resolve to a positive whole-number count.");
  }

  const resultValue = computed.resultValue * repetitionMultiplier;
  if (!Number.isFinite(resultValue) || resultValue <= 0) {
    throw new Error("Composite TAYQAN measurement returned an invalid total quantity.");
  }

  const compositeConfidence = Math.min(
    confidence,
    ...repetitionChecks.map((check) => check.confidence),
  );

  const scaleComponents = (
    values: Record<string, number> | undefined,
  ): Record<string, number> | null => {
    if (!values) return null;
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        value * repetitionMultiplier,
      ]),
    );
  };

  return {
    subject,
    normalizedInputValues,
    formula: repetitionMultiplier === 1
      ? computed.formula
      : `(${computed.formula}) × repetitionCount(${repetitionMultiplier})`,
    baseResultValue: computed.resultValue,
    repetitionMultiplier,
    resultValue,
    resultUnit: computed.resultUnit,
    deductions: scaleComponents(computed.deductions),
    allowances: scaleComponents(computed.allowances),
    confidence: compositeConfidence,
    supportingChecks,
  };
}
