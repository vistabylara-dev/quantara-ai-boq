import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ExtractedEntityType, QuantityCalculationType } from "@prisma/client";
import {
  derivationConfidenceCap,
  evaluateTayqanMeasurementSubject,
  normalizeTayqanMeasurementValue,
  tayqanMeasurementMethodForCalculationType,
  TayqanRevisionConflictError,
} from "../src/lib/tayqan/tayqan-measurement-contract";
import {
  applyTayqanSeniorReview,
  buildTayqanMeasurementClusters,
  calculateTayqanEvidencePageCoveragePercent,
  classifyTayqanDrawingPageRole,
  mergeTayqanMeasurementPlans,
  tayqanMeasurementProposalKey,
  tayqanSeniorReviewSchema,
  type TayqanMeasurementPageEvidence,
} from "../src/lib/tayqan/tayqan-measurement-reasoner";
import type { TayqanMeasurementSubject } from "../src/lib/tayqan/tayqan-measurement-contract";
import { createOpenAITayqanMeasurementReasoner } from "../src/lib/tayqan/openai-tayqan-measurement-reasoner";

const PAGE_PLAN = "11111111-1111-4111-8111-111111111111";
const PAGE_SECTION = "22222222-2222-4222-8222-222222222222";
const PAGE_SCHEDULE = "33333333-3333-4333-8333-333333333333";
const PAGE_DETAIL = "44444444-4444-4444-8444-444444444444";

function page(overrides: Partial<TayqanMeasurementPageEvidence>): TayqanMeasurementPageEvidence {
  return {
    id: PAGE_PLAN,
    projectFileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    originalName: "A-101.pdf",
    pageNumber: 1,
    drawingNumber: "A-101",
    drawingTitle: "Floor Plan",
    revisionNumber: "P01",
    discipline: "Architectural",
    drawingType: "Plan",
    sheetName: null,
    role: "PLAN",
    width: 2000,
    height: 1400,
    dpi: 144,
    text: null,
    drawingTitles: [],
    technicalLines: [],
    detectedScale: "1:100",
    scaleVerified: false,
    scaleRatio: null,
    drawingUnit: null,
    realWorldUnit: null,
    hasImage: true,
    ...overrides,
  };
}

function pageGuard(overrides: Partial<{
  projectFileId: string;
  scaleVerified: boolean;
  drawingNumber: string | null;
  revisionNumber: string | null;
  role: string;
}> = {}) {
  return {
    projectFileId: "f1",
    scaleVerified: false,
    drawingNumber: "A-101",
    revisionNumber: "P01",
    role: "PLAN",
    ...overrides,
  };
}

function wallSubject(): TayqanMeasurementSubject {
  return {
    existingEntityId: null,
    primaryPageId: PAGE_PLAN,
    evidencePageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE],
    entityType: ExtractedEntityType.WALL_FINISH,
    label: "Painted gypsum wall finish",
    workPackage: "Architectural finishes",
    location: "Level 01 corridor",
    measurementMethod: "AREA",
    methodSelectionRationale: "Wall finish is paid by measured surface area.",
    methodConfidence: 96,
    calculationType: QuantityCalculationType.WALL_AREA,
    inputs: [
      {
        key: "wallLength",
        value: 6200,
        unit: "mm",
        derivation: "EXPLICIT_DIMENSION",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "A-101 printed wall dimension reads 6200 mm.",
        confidence: 96,
      },
      {
        key: "wallHeight",
        value: 3000,
        unit: "mm",
        derivation: "EXPLICIT_DIMENSION",
        evidencePageIds: [PAGE_SECTION],
        evidenceRoomIds: [],
        evidenceNote: "A-301 section gives 3000 mm finished wall height.",
        confidence: 94,
      },
      {
        key: "openingsArea",
        value: 2.1,
        unit: "m2",
        derivation: "SCHEDULE_VALUE",
        evidencePageIds: [PAGE_SCHEDULE],
        evidenceRoomIds: [],
        evidenceNote: "Door schedule opening serving this wall totals 2.1 m2.",
        confidence: 92,
      },
    ],
    supportingChecks: [],
    rationale: "Plan supplies wall length, section supplies height, door schedule supplies opening deduction.",
    sourceSummary: "A-101 + A-301 + D-601",
    confidence: 95,
  };
}

describe("TAYQAN senior measurement contract", () => {
  it("normalizes metric and imperial engineering units without guessing", () => {
    expect(normalizeTayqanMeasurementValue(6200, "mm", "m")).toBeCloseTo(6.2);
    expect(normalizeTayqanMeasurementValue(286000000, "mm2", "m2")).toBeCloseTo(286);
    expect(normalizeTayqanMeasurementValue(100, "ft2", "m2")).toBeCloseTo(9.290304);
    expect(normalizeTayqanMeasurementValue(10, "ft", "m")).toBeCloseTo(3.048);
    expect(normalizeTayqanMeasurementValue(1.5, "t", "kg")).toBe(1500);
    expect(() => normalizeTayqanMeasurementValue(12, null, "m")).toThrow(/source unit/i);
  });

  it("combines cross-page plan + section + schedule evidence and keeps deterministic arithmetic server-side", () => {
    const result = evaluateTayqanMeasurementSubject(wallSubject(), {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([
        [PAGE_PLAN, pageGuard({ projectFileId: "f1", drawingNumber: "A-101", role: "PLAN" })],
        [PAGE_SECTION, pageGuard({ projectFileId: "f2", drawingNumber: "A-301", role: "SECTION" })],
        [PAGE_SCHEDULE, pageGuard({ projectFileId: "f3", drawingNumber: "D-601", role: "SCHEDULE" })],
      ]),
    });

    expect(result.normalizedInputValues.wallLength).toBeCloseTo(6.2);
    expect(result.normalizedInputValues.wallHeight).toBeCloseTo(3);
    expect(result.resultUnit).toBe("m2");
    expect(result.resultValue).toBeCloseTo(16.5);
    // TAYQAN-AUDIT-FIX-1: EXPLICIT_DIMENSION/SCHEDULE_VALUE's cap dropped from
    // 98 to 90 (self-declared derivations, no code-enforced verification) —
    // now the binding constraint on this subject, below the lowest input
    // confidence (92).
    expect(result.confidence).toBe(90);
  });

  it("refuses pixel/scaled geometry unless the cited page scale is verified", () => {
    expect(() => evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.FLOOR_FINISH,
      label: "Floor tile",
      workPackage: "Floor finishes",
      location: "Level 01",
      measurementMethod: "AREA",
      methodSelectionRationale: "Floor finish is a payable surface-area scope.",
      methodConfidence: 95,
      calculationType: QuantityCalculationType.FLOOR_AREA,
      inputs: [{
        key: "netFloorArea",
        value: 25,
        unit: "m2",
        derivation: "VERIFIED_SCALE_GEOMETRY",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "Polygon measurement from plan geometry.",
        confidence: 90,
      }],
      supportingChecks: [],
      rationale: "Measured polygon from page geometry.",
      sourceSummary: "A-101",
      confidence: 90,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([[PAGE_PLAN, pageGuard({ scaleVerified: false })]]),
    })).toThrow(/unverified drawing scale/i);
  });

  it("caps confidence for verified-scale geometry instead of trusting model confidence blindly", () => {
    // TAYQAN-AUDIT-FIX-1: methodConfidence raised to 100 (was 95) so the
    // derivation cap under test is actually the binding constraint — at the
    // old, buggy cap (88) it would have bound regardless, but now that
    // VERIFIED_SCALE_GEOMETRY's cap is 98 (the highest tier, correctly
    // reflecting real code-enforced scale verification), a methodConfidence
    // of 95 would have silently become the binding minimum instead and this
    // test would stop demonstrating what its name claims.
    const result = evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.FLOOR_FINISH,
      label: "Floor tile",
      workPackage: "Floor finishes",
      location: "Level 01",
      measurementMethod: "AREA",
      methodSelectionRationale: "Floor finish is a payable surface-area scope.",
      methodConfidence: 100,
      calculationType: QuantityCalculationType.FLOOR_AREA,
      inputs: [{
        key: "netFloorArea",
        value: 25,
        unit: "m2",
        derivation: "VERIFIED_SCALE_GEOMETRY",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "Verified calibrated polygon measurement.",
        confidence: 100,
      }],
      supportingChecks: [],
      rationale: "Verified scale polygon.",
      sourceSummary: "A-101",
      confidence: 100,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([[PAGE_PLAN, pageGuard({ scaleVerified: true })]]),
    });

    expect(result.confidence).toBe(98);
  });

  it("refuses stored room geometry unless that room cites a verified scale calibration", () => {
    const roomId = "55555555-5555-4555-8555-555555555555";
    expect(() => evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.FLOOR_FINISH,
      label: "Floor tile from stored room boundary",
      workPackage: "Floor finishes",
      location: "Room 101",
      measurementMethod: "AREA",
      methodSelectionRationale: "Floor finish is a payable surface-area scope.",
      methodConfidence: 95,
      calculationType: QuantityCalculationType.FLOOR_AREA,
      inputs: [{
        key: "netFloorArea",
        value: 25,
        unit: "m2",
        derivation: "ROOM_GEOMETRY",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [roomId],
        evidenceNote: "Stored detected room polygon.",
        confidence: 90,
      }],
      supportingChecks: [],
      rationale: "Stored room polygon area.",
      sourceSummary: "Room boundary on A-101",
      confidence: 90,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map([[roomId, { scaleVerified: false }]]),
      pagesById: new Map([[PAGE_PLAN, pageGuard()]]),
    })).toThrow(/room geometry without a verified scale calibration/i);
  });

  it("requires primary-page provenance and refuses mixed revisions of the same drawing", () => {
    const missingPrimary = { ...wallSubject(), evidencePageIds: [PAGE_SECTION, PAGE_SCHEDULE] };
    expect(() => evaluateTayqanMeasurementSubject(missingPrimary, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([
        [PAGE_PLAN, pageGuard()],
        [PAGE_SECTION, pageGuard({ projectFileId: "f2", drawingNumber: "A-301", role: "SECTION" })],
        [PAGE_SCHEDULE, pageGuard({ projectFileId: "f3", drawingNumber: "D-601", role: "SCHEDULE" })],
      ]),
    })).toThrow(/primary page must be included/i);

    const mixedRevision = {
      ...wallSubject(),
      evidencePageIds: [PAGE_PLAN, PAGE_SECTION],
      inputs: wallSubject().inputs.slice(0, 2),
    };
    expect(() => evaluateTayqanMeasurementSubject(mixedRevision, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([
        [PAGE_PLAN, pageGuard({ drawingNumber: "A-101", revisionNumber: "P01" })],
        [PAGE_SECTION, pageGuard({ projectFileId: "f2", drawingNumber: "A-101", revisionNumber: "P02", role: "SECTION" })],
      ]),
    })).toThrow(/mixed revisions/i);
  });

  it("PR2 gap 3: a genuine revision-mix condition throws TayqanRevisionConflictError, a structured, catchable exception producer — not a plain, unhandled Error", () => {
    const mixedRevision = {
      ...wallSubject(),
      existingEntityId: null,
      evidencePageIds: [PAGE_PLAN, PAGE_SECTION],
      inputs: wallSubject().inputs.slice(0, 2),
    };
    let caught: unknown;
    try {
      evaluateTayqanMeasurementSubject(mixedRevision, {
        allowedEntityIds: new Set(),
        roomsById: new Map(),
        pagesById: new Map([
          [PAGE_PLAN, pageGuard({ drawingNumber: "A-101", revisionNumber: "P01" })],
          [PAGE_SECTION, pageGuard({ projectFileId: "f2", drawingNumber: "A-101", revisionNumber: "P02", role: "SECTION" })],
        ]),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TayqanRevisionConflictError);
    const exception = (caught as TayqanRevisionConflictError).exception;
    expect(exception.kind).toBe("REVISION_CONFLICT");
    expect(exception.pageIds.sort()).toEqual([PAGE_PLAN, PAGE_SECTION].sort());
    expect(exception.relatedEntityId).toBeNull();
    expect(exception.message).toMatch(/mixed revisions/i);
  });

  it("accepts a bounded direct count without pretending it was cross-source reconciled", () => {
    const result = evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.EQUIPMENT,
      label: "Visible fan coil units",
      workPackage: "HVAC equipment",
      location: "Level 01",
      measurementMethod: "COUNT",
      methodSelectionRationale: "Discrete equipment is payable by number.",
      methodConfidence: 94,
      calculationType: QuantityCalculationType.COUNT,
      inputs: [{
        key: "verifiedCount",
        value: 12,
        unit: null,
        derivation: "DIRECT_COUNT",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "Twelve distinct FCU symbols are visibly counted on the frozen plan.",
        confidence: 92,
      }],
      supportingChecks: [],
      rationale: "Directly count unambiguous discrete symbols on the bounded plan.",
      sourceSummary: "M-101",
      confidence: 94,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([[PAGE_PLAN, pageGuard()]]),
    });
    expect(result.resultValue).toBe(12);
    expect(result.resultUnit).toBe("nr");
    // TAYQAN-AUDIT-FIX-1: DIRECT_COUNT's cap dropped from 90 to 88 (lowest of
    // the self-declared tier — a visual count is the least verifiable of the
    // three unverified derivations).
    expect(result.confidence).toBe(88);
  });

  it("requires real multi-source evidence before calling a count reconciled", () => {
    expect(() => evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.EQUIPMENT,
      label: "Fan coil units",
      workPackage: "HVAC equipment",
      location: "Level 01",
      measurementMethod: "COUNT",
      methodSelectionRationale: "Discrete equipment is measured by number.",
      methodConfidence: 96,
      calculationType: QuantityCalculationType.COUNT,
      inputs: [{
        key: "verifiedCount",
        value: 12,
        unit: null,
        derivation: "COUNT_RECONCILIATION",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "Only one source was supplied.",
        confidence: 96,
      }],
      supportingChecks: [],
      rationale: "Count claimed as reconciled.",
      sourceSummary: "M-101",
      confidence: 96,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([[PAGE_PLAN, pageGuard()]]),
    })).toThrow(/at least two independent page references/i);
  });

  it("never accepts rates or arbitrary formula inputs because the strict registry owns the formula contract", () => {
    expect(() => evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN],
      entityType: ExtractedEntityType.FLOOR_FINISH,
      label: "Floor tile",
      workPackage: "Floor finishes",
      location: "Level 01",
      measurementMethod: "AREA",
      methodSelectionRationale: "Floor finish is a payable surface-area scope.",
      methodConfidence: 95,
      calculationType: QuantityCalculationType.FLOOR_AREA,
      inputs: [{
        key: "unitPrice",
        value: 50,
        unit: null,
        derivation: "SCHEDULE_VALUE",
        evidencePageIds: [PAGE_PLAN],
        evidenceRoomIds: [],
        evidenceNote: "Forbidden commercial field.",
        confidence: 100,
      }],
      supportingChecks: [],
      rationale: "Forbidden commercial field.",
      sourceSummary: "A-101",
      confidence: 100,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([[PAGE_PLAN, pageGuard()]]),
    })).toThrow(/unexpected input/i);
  });

  it("maps every supported deterministic calculator to one autonomous measurement family", () => {
    const expected = new Map([
      [QuantityCalculationType.COUNT, "COUNT"],
      [QuantityCalculationType.SKIRTING_LENGTH, "LINEAR"],
      [QuantityCalculationType.PIPE_LENGTH, "LINEAR"],
      [QuantityCalculationType.CABLE_LENGTH, "LINEAR"],
      [QuantityCalculationType.FLOOR_AREA, "AREA"],
      [QuantityCalculationType.CEILING_AREA, "AREA"],
      [QuantityCalculationType.WALL_AREA, "AREA"],
      [QuantityCalculationType.PAINT_AREA, "AREA"],
      [QuantityCalculationType.PARTITION_AREA, "AREA"],
      [QuantityCalculationType.DUCT_SURFACE_AREA, "AREA"],
      [QuantityCalculationType.FORMWORK_AREA, "AREA"],
      [QuantityCalculationType.CONCRETE_VOLUME, "VOLUME"],
      [QuantityCalculationType.EXCAVATION_VOLUME, "VOLUME"],
      [QuantityCalculationType.REINFORCEMENT_WEIGHT, "WEIGHT"],
    ] as const);
    for (const [calculationType, method] of expected) {
      expect(tayqanMeasurementMethodForCalculationType(calculationType)).toBe(method);
    }
  });

  it("rejects a calculator that does not match TAYQAN's selected measurement method", () => {
    expect(() => evaluateTayqanMeasurementSubject({
      ...wallSubject(),
      measurementMethod: "VOLUME",
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([
        [PAGE_PLAN, pageGuard()],
        [PAGE_SECTION, pageGuard({ projectFileId: "f2", drawingNumber: "A-301", role: "SECTION" })],
        [PAGE_SCHEDULE, pageGuard({ projectFileId: "f3", drawingNumber: "D-601", role: "SCHEDULE" })],
      ]),
    })).toThrow(/does not match calculator/i);
  });

  it("supports a footing volume as the payable quantity with count as a non-BOQ supporting cross-check", () => {
    const footing = evaluateTayqanMeasurementSubject({
      existingEntityId: null,
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN, PAGE_DETAIL],
      entityType: ExtractedEntityType.STRUCTURAL_ELEMENT,
      label: "Concrete in F1 footings",
      workPackage: "Structural concrete",
      location: "Foundation level",
      measurementMethod: "VOLUME",
      methodSelectionRationale: "Concrete is payable by cubic volume; footing occurrence count is corroboration only.",
      methodConfidence: 98,
      calculationType: QuantityCalculationType.CONCRETE_VOLUME,
      inputs: [
        { key: "length", value: 1.6, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_DETAIL], evidenceRoomIds: [], evidenceNote: "F1 detail length is 1.60 m.", confidence: 98 },
        { key: "width", value: 1.2, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_DETAIL], evidenceRoomIds: [], evidenceNote: "F1 detail width is 1.20 m.", confidence: 98 },
        { key: "depth", value: 0.35, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_DETAIL], evidenceRoomIds: [], evidenceNote: "F1 detail depth is 0.35 m.", confidence: 98 },
      ],
      supportingChecks: [{
        application: "REPETITION_MULTIPLIER",
        measurementMethod: "COUNT",
        calculationType: QuantityCalculationType.COUNT,
        inputs: [{
          key: "verifiedCount",
          value: 12,
          unit: null,
          derivation: "DIRECT_COUNT",
          evidencePageIds: [PAGE_PLAN],
          evidenceRoomIds: [],
          evidenceNote: "Twelve distinct F1 footing symbols are visible on the frozen foundation plan.",
          confidence: 90,
        }],
        rationale: "Occurrence count corroborates the repeated footing scope but does not create another payable BOQ row.",
        confidence: 94,
      }],
      rationale: "Use the footing detail for geometry and plan occurrence evidence as a separate cross-check.",
      sourceSummary: "Foundation plan + F1 detail",
      confidence: 97,
    }, {
      allowedEntityIds: new Set(),
      roomsById: new Map(),
      pagesById: new Map([
        [PAGE_PLAN, pageGuard({ drawingNumber: "S-101", role: "PLAN" })],
        [PAGE_DETAIL, pageGuard({ projectFileId: "f4", drawingNumber: "S-501", role: "DETAIL" })],
      ]),
    });

    expect(footing.subject.measurementMethod).toBe("VOLUME");
    expect(footing.resultUnit).toBe("m3");
    expect(footing.baseResultValue).toBeCloseTo(0.672);
    expect(footing.repetitionMultiplier).toBe(12);
    expect(footing.resultValue).toBeCloseTo(8.064);
    expect(footing.supportingChecks).toHaveLength(1);
    expect(footing.supportingChecks[0]?.application).toBe("REPETITION_MULTIPLIER");
    expect(footing.supportingChecks[0]?.measurementMethod).toBe("COUNT");
    expect(footing.supportingChecks[0]?.resultValue).toBe(12);
  });

  it("TAYQAN-AUDIT-FIX-1: a code-verified derivation's confidence cap is never lower than a self-declared derivation's cap", () => {
    const codeVerified = ["VERIFIED_SCALE_GEOMETRY", "ROOM_GEOMETRY", "COUNT_RECONCILIATION"] as const;
    const selfDeclared = ["EXPLICIT_DIMENSION", "SCHEDULE_VALUE", "DIRECT_COUNT"] as const;

    const codeVerifiedCaps = codeVerified.map(derivationConfidenceCap);
    const selfDeclaredCaps = selfDeclared.map(derivationConfidenceCap);

    const minCodeVerified = Math.min(...codeVerifiedCaps);
    const maxSelfDeclared = Math.max(...selfDeclaredCaps);
    expect(minCodeVerified).toBeGreaterThanOrEqual(maxSelfDeclared);

    // Direct, per-kind assertions too — not just the aggregate min/max
    // comparison above, so a future edit that regresses just one pairing
    // (e.g. only COUNT_RECONCILIATION vs. SCHEDULE_VALUE) still fails here.
    for (const verified of codeVerified) {
      for (const unverified of selfDeclared) {
        expect(derivationConfidenceCap(verified)).toBeGreaterThanOrEqual(derivationConfidenceCap(unverified));
      }
    }
  });

});

describe("TAYQAN senior cross-page orchestration", () => {
  it("classifies anchor pages and follows explicit drawing call-outs into details", () => {
    expect(classifyTayqanDrawingPageRole({ drawingTitle: "Typical Section A-A" })).toBe("SECTION");
    expect(classifyTayqanDrawingPageRole({ drawingTitle: "Door Schedule" })).toBe("SCHEDULE");
    expect(classifyTayqanDrawingPageRole({ drawingTitle: "جدول الأبواب" })).toBe("SCHEDULE");
    expect(classifyTayqanDrawingPageRole({ drawingTitle: "مخطط الطابق الأول" })).toBe("PLAN");

    const pages = [
      page({ id: PAGE_PLAN, pageNumber: 1, role: "PLAN", text: "REFER DETAIL A-501 FOR THRESHOLD" }),
      page({ id: PAGE_SECTION, pageNumber: 2, drawingNumber: "A-301", drawingTitle: "Section A-A", role: "SECTION" }),
      page({ id: PAGE_SCHEDULE, pageNumber: 3, drawingNumber: "A-601", drawingTitle: "Door Schedule", role: "SCHEDULE" }),
      page({ id: PAGE_DETAIL, pageNumber: 4, drawingNumber: "A-501", drawingTitle: "Threshold Details", role: "DETAIL", discipline: "Interiors" }),
    ];

    const clusters = buildTayqanMeasurementClusters(pages, 8);
    const planCluster = clusters.find((cluster) => cluster.pageIds.includes(PAGE_PLAN));
    expect(planCluster?.pageIds).toContain(PAGE_DETAIL);
    expect(new Set(clusters.flatMap((cluster) => cluster.pageIds))).toEqual(
      new Set(pages.map((entry) => entry.id)),
    );
  });

  it("requires the independent senior checker to decide every proposal and removes rejected scope", () => {
    const subject = wallSubject();
    const proposalKey = tayqanMeasurementProposalKey(subject);
    const applied = applyTayqanSeniorReview({ subjects: [subject], exceptions: [] }, {
      decisions: [{
        proposalKey,
        decision: "REJECT",
        exceptionKind: "DOUBLE_COUNT_RISK",
        severity: "HIGH",
        message: "The same wall finish is already represented by the existing extraction candidate.",
        pageIds: [PAGE_PLAN],
      }],
      findings: [],
    }, new Set([PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE]));

    expect(applied.plan.subjects).toHaveLength(0);
    expect(applied.plan.exceptions[0]?.kind).toBe("DOUBLE_COUNT_RISK");
    expect(applied.rejectedCount).toBe(1);
  });

  it("fails closed if the senior checker omits a proposal decision", () => {
    const subject = wallSubject();
    expect(() => applyTayqanSeniorReview({ subjects: [subject], exceptions: [] }, {
      decisions: [],
      findings: [],
    }, new Set([PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE]))).toThrow(/omitted proposal decision/i);
  });

  it("fails closed when an acceptance carries an exception or lacks evidence pages", () => {
    const subject = wallSubject();
    const proposalKey = tayqanMeasurementProposalKey(subject);
    const scope = new Set([PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE]);
    expect(() => applyTayqanSeniorReview({ subjects: [subject], exceptions: [] }, {
      decisions: [{ proposalKey, decision: "ACCEPT", exceptionKind: "DOUBLE_COUNT_RISK", severity: "LOW", message: "Invalid acceptance", pageIds: [PAGE_PLAN] }],
      findings: [],
    }, scope)).toThrow(/acceptance cannot carry an exception/i);
    expect(() => tayqanSeniorReviewSchema.parse({
      decisions: [{ proposalKey, decision: "ACCEPT", exceptionKind: null, severity: "LOW", message: "Missing evidence", pageIds: [] }],
      findings: [],
    })).toThrow();
  });

  it("keeps multilingual proposal identity instead of collapsing Arabic scope labels", () => {
    const base = wallSubject();
    const arabicA: TayqanMeasurementSubject = {
      ...base,
      label: "دهان جدران الممر",
      workPackage: "التشطيبات المعمارية",
      location: "الطابق الأول",
    };
    const arabicB: TayqanMeasurementSubject = {
      ...base,
      label: "دهان جدران الردهة",
      workPackage: "التشطيبات المعمارية",
      location: "الطابق الأول",
    };
    expect(tayqanMeasurementProposalKey(arabicA)).not.toBe(
      tayqanMeasurementProposalKey(arabicB),
    );
  });


  it("does not collapse multiple payable calculators onto one extracted source entity", () => {
    const entityId = "66666666-6666-4666-8666-666666666666";
    const wall = { ...wallSubject(), existingEntityId: entityId };
    const volume: TayqanMeasurementSubject = {
      ...wall,
      label: "Concrete volume from shared source",
      measurementMethod: "VOLUME",
      methodSelectionRationale: "Concrete is payable by volume.",
      calculationType: QuantityCalculationType.CONCRETE_VOLUME,
      inputs: [
        { key: "length", value: 1, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_PLAN], evidenceRoomIds: [], evidenceNote: "Length 1 m.", confidence: 95 },
        { key: "width", value: 1, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_PLAN], evidenceRoomIds: [], evidenceNote: "Width 1 m.", confidence: 95 },
        { key: "depth", value: 1, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [PAGE_PLAN], evidenceRoomIds: [], evidenceNote: "Depth 1 m.", confidence: 95 },
      ],
      supportingChecks: [],
    };
    const merged = mergeTayqanMeasurementPlans([
      { subjects: [wall, volume], exceptions: [] },
    ]);
    expect(merged.subjects).toHaveLength(0);
    expect(merged.exceptions.some((exception) =>
      exception.kind === "COMPOSITE_SCOPE_REQUIRES_SPLIT"
      && exception.relatedEntityId === entityId
    )).toBe(true);
  });

  it("scales merged senior plans beyond the old 350-subject ceiling", () => {
    const subjects = Array.from({ length: 400 }, (_, index): TayqanMeasurementSubject => ({
      ...wallSubject(),
      primaryPageId: PAGE_PLAN,
      evidencePageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE],
      label: `Wall finish ${index + 1}`,
      location: `Zone ${index + 1}`,
    }));
    const merged = mergeTayqanMeasurementPlans([
      { subjects: subjects.slice(0, 200), exceptions: [] },
      { subjects: subjects.slice(200), exceptions: [] },
    ]);
    expect(merged.subjects).toHaveLength(400);
  });

  it("runtime-validates senior checker output instead of trusting parsed JSON", () => {
    expect(() => tayqanSeniorReviewSchema.parse({
      decisions: [{
        proposalKey: "proposal-1",
        decision: "REJECT",
        exceptionKind: "NOT_A_REAL_EXCEPTION",
        severity: "HIGH",
        message: "Invalid checker payload",
        pageIds: [PAGE_PLAN],
      }],
      findings: [],
    })).toThrow();
  });

  it("reports evidence-page coverage as a quality metric rather than pretending it is professional sign-off", () => {
    const pages = [
      page({ id: PAGE_PLAN }),
      page({ id: PAGE_SECTION, drawingNumber: "A-301" }),
      page({ id: PAGE_SCHEDULE, drawingNumber: "A-601" }),
      page({ id: PAGE_DETAIL, drawingNumber: "A-501" }),
    ];
    const coverage = calculateTayqanEvidencePageCoveragePercent({
      subjects: [wallSubject()],
      exceptions: [],
    }, pages);
    expect(coverage).toBe(75);
  });
});

describe("TAYQAN senior OpenAI orchestration — mocked, zero network", () => {
  function responseJson(id: string, payload: unknown): Response {
    return new Response(JSON.stringify({
      id,
      status: "completed",
      output_text: JSON.stringify(payload),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function bundlePages(): TayqanMeasurementPageEvidence[] {
    return [
      page({ id: PAGE_PLAN, pageNumber: 1, drawingNumber: "A-101", role: "PLAN", text: "6200 wall length" }),
      page({ id: PAGE_SECTION, pageNumber: 2, drawingNumber: "A-301", drawingTitle: "Section", role: "SECTION", text: "3000 wall height" }),
      page({ id: PAGE_SCHEDULE, pageNumber: 3, drawingNumber: "D-601", drawingTitle: "Door Schedule", role: "SCHEDULE", text: "opening area 2.1 m2" }),
    ];
  }

  it("surfaces a safe retryable provider status and request reference", async () => {
    const fakeFetch = (async () => new Response(
      JSON.stringify({ error: { message: "must never reach the customer" } }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req_tayqan_diagnostic",
        },
      },
    )) as typeof fetch;

    const reasoner = createOpenAITayqanMeasurementReasoner({
      apiKey: "test-key",
      model: "gpt-5.6",
    }, fakeFetch);

    const input = {
      bundle: {
        project: { id: "project-1", slug: "project-1", name: "Test", reference: "Q-001" },
        governingContext: null,
        sourceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        pages: [page({})],
        existingEntities: [],
        existingBoqItems: [],
        rooms: [],
      },
      loadPageImageDataUrl: async () => null,
    };

    await expect(reasoner(input)).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
      status: 503,
      message: expect.stringContaining("HTTP 400"),
    });

    await expect(reasoner(input)).rejects.toThrow(
      "Provider request: req_tayqan_diagnostic",
    );
  });

  it("surfaces an incomplete structured response as a safe retryable TAYQAN error", async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({
      id: "resp_incomplete",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    const reasoner = createOpenAITayqanMeasurementReasoner({
      apiKey: "test-key",
      model: "gpt-5.6",
    }, fakeFetch);

    await expect(reasoner({
      bundle: {
        project: { id: "project-1", slug: "project-1", name: "Test", reference: "Q-001" },
        governingContext: null,
        sourceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        pages: [page({})],
        existingEntities: [],
        existingBoqItems: [],
        rooms: [],
      },
      loadPageImageDataUrl: async () => null,
    })).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_AI_RESPONSE_INCOMPLETE",
      status: 503,
      message: expect.stringContaining("max_output_tokens"),
    });
  });

  it("sends GPT-5.6 original-detail images without storing drawing-analysis responses", async () => {
    const requests: Record<string, unknown>[] = [];
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return responseJson("resp-measure", { subjects: [], exceptions: [] });
    }) as typeof fetch;

    const reasoner = createOpenAITayqanMeasurementReasoner({
      apiKey: "test-key",
      model: "gpt-5.6",
      safetyIdentifier: "tayqan_test_company",
      useSeniorProMode: false,
    }, fakeFetch);

    await reasoner({
      bundle: {
        project: { id: "project-1", slug: "project-1", name: "Test", reference: "Q-001" },
        governingContext: null,
        sourceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        pages: [page({})],
        existingEntities: [],
        existingBoqItems: [],
        rooms: [],
      },
      loadPageImageDataUrl: async () => "data:image/png;base64,AAAA",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.model).toBe("gpt-5.6");
    expect(requests[0]?.store).toBe(false);
    expect(requests[0]?.safety_identifier).toBe("tayqan_test_company");
    expect(requests[0]?.reasoning).toEqual({ effort: "high" });
    const measurementRequestText = JSON.stringify(requests[0]);
    expect(measurementRequestText).toContain("measurementMethod");
    expect(measurementRequestText).toContain("supportingChecks");
    expect(measurementRequestText).toContain("user must not be asked to choose a calculator");

    const input = requests[0]?.input as Array<{ content: Array<Record<string, unknown>> }>;
    const image = input[0]?.content.find((item) => item.type === "input_image");
    expect(image?.detail).toBe("original");
  });

  it("runs measurement, independent xhigh cluster check, then max/pro global reconciliation", async () => {
    const subject = wallSubject();
    const proposalKey = tayqanMeasurementProposalKey(subject);
    const requests: Record<string, unknown>[] = [];
    const payloads = [
      { subjects: [subject], exceptions: [] },
      {
        decisions: [{
          proposalKey,
          decision: "ACCEPT",
          exceptionKind: null,
          severity: "LOW",
          message: "Cluster evidence supports the proposed deterministic inputs.",
          pageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE],
        }],
        findings: [],
      },
      {
        decisions: [{
          proposalKey,
          decision: "ACCEPT",
          exceptionKind: null,
          severity: "LOW",
          message: "Global reconciliation found no duplicate or conflicting scope.",
          pageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE],
        }],
        findings: [],
      },
    ];
    let call = 0;
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const payload = payloads[call];
      call += 1;
      return responseJson(`resp-${call}`, payload);
    }) as typeof fetch;

    const reasoner = createOpenAITayqanMeasurementReasoner({
      apiKey: "test-key",
      model: "gpt-5.6",
      safetyIdentifier: "tayqan_test_company",
      useSeniorProMode: true,
    }, fakeFetch);

    const result = await reasoner({
      bundle: {
        project: { id: "project-1", slug: "project-1", name: "Test", reference: "Q-001" },
        governingContext: {
          projectCategory: "Commercial fit-out",
          categoryScope: "Architectural finishes",
          measurementStandard: "Client-specified measurement rules",
          exclusions: "Loose furniture",
          deadlineText: null,
          specialInstructions: "Measure net openings from the door schedule where evidenced.",
          pricingBasis: null,
          authoritativeSourcePolicy: "USE_LATEST_REVISION",
        },
        sourceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        pages: bundlePages(),
        existingEntities: [],
        existingBoqItems: [],
        rooms: [],
      },
      loadPageImageDataUrl: async () => "data:image/png;base64,AAAA",
    });

    expect(requests).toHaveLength(3);
    expect(requests[0]?.reasoning).toEqual({ effort: "high" });
    expect(requests[1]?.reasoning).toEqual({ effort: "xhigh" });
    expect(requests[2]?.reasoning).toEqual({ effort: "max", mode: "pro" });
    expect(requests.every((request) => request.store === false)).toBe(true);
    expect(result.plan.subjects).toHaveLength(1);
    expect(result.seniorReview.globalReviewApplied).toBe(true);
    expect(result.seniorReview.acceptedSubjectCount).toBe(1);
    expect(result.responseIds).toHaveLength(3);
  });

  it("PR2 gap 1: a table/schedule entity (no drawingPageId, different projectFileId than any cluster page) reaches the cluster measurement prompt and the global reconciliation prompt — not just the bundle object", async () => {
    const subject = wallSubject();
    const proposalKey = tayqanMeasurementProposalKey(subject);
    const requests: Record<string, unknown>[] = [];
    const payloads = [
      { subjects: [subject], exceptions: [] },
      { decisions: [{ proposalKey, decision: "ACCEPT", exceptionKind: null, severity: "LOW", message: "ok", pageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE] }], findings: [] },
      { decisions: [{ proposalKey, decision: "ACCEPT", exceptionKind: null, severity: "LOW", message: "ok", pageIds: [PAGE_PLAN, PAGE_SECTION, PAGE_SCHEDULE] }], findings: [] },
    ];
    let call = 0;
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const payload = payloads[call];
      call += 1;
      return responseJson(`resp-${call}`, payload);
    }) as typeof fetch;

    const reasoner = createOpenAITayqanMeasurementReasoner({
      apiKey: "test-key",
      model: "gpt-5.6",
      safetyIdentifier: "tayqan_test_company",
      useSeniorProMode: true,
    }, fakeFetch);

    // TABLE_PARSER entity from a schedule/CSV/XLSX file: no drawingPageId,
    // and its projectFileId ("table-file-id") belongs to no page in this
    // bundle at all — under the pre-PR2 filter (page match OR cluster-file
    // match) this would never reach any cluster's prompt.
    const scheduleEntity = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      projectFileId: "table-file-id",
      drawingPageId: null,
      entityType: "REBAR_SCHEDULE" as const,
      label: "Rebar bending schedule row B12",
      quantity: 145.5,
      unit: "kg",
      confidence: 92,
      status: "CONFIRMED",
      sourceText: "B12 T16-200 145.5kg",
      sourceReference: "rebar-schedule.xlsx",
      technicalData: null,
      extractionMethod: "TABLE_PARSER",
    };

    await reasoner({
      bundle: {
        project: { id: "project-1", slug: "project-1", name: "Test", reference: "Q-001" },
        governingContext: null,
        sourceFileIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "table-file-id"],
        pages: bundlePages(),
        existingEntities: [scheduleEntity],
        existingBoqItems: [{ id: "boq-item-1", sectionCode: "FND", sectionTitle: "Foundations", itemCode: "F-01", description: "Existing footing concrete", quantity: 12, unit: "m3" }],
        rooms: [],
      },
      loadPageImageDataUrl: async () => "data:image/png;base64,AAAA",
    });

    // Cluster measurement request (requests[0]): the schedule entity must be
    // present, tagged so the model knows it's schedule data, not a page.
    const clusterRequestText = JSON.stringify(requests[0]);
    expect(clusterRequestText).toContain("Rebar bending schedule row B12");
    expect(clusterRequestText).toContain("TABLE_SCHEDULE");
    // The existing-BOQ reconciliation context reaches the same cluster prompt.
    expect(clusterRequestText).toContain("Existing footing concrete");

    // Global reconciliation request (requests[2]): scheduleEvidence and
    // existingBoqItems both reach compactProjectContext too.
    const globalRequestText = JSON.stringify(requests[2]);
    expect(globalRequestText).toContain("Rebar bending schedule row B12");
    expect(globalRequestText).toContain("Existing footing concrete");
  });
});

describe("TAYQAN senior work-order governance wiring", () => {
  it("passes frozen customer instructions into the measurement brain and versions the checkpoint", () => {
    const workOrder = readFileSync(
      "src/lib/services/tayqan-work-order-service.ts",
      "utf8",
    );
    expect(workOrder).toContain(
      "progress.tayqanMeasurement?.version !== TAYQAN_MEASUREMENT_VERSION",
    );
    expect(workOrder).toContain(
      "governingContext: leasedProgress.instructionContext ?? null",
    );
    expect(workOrder).toContain("seniorReview: measurement.seniorReview");
    expect(workOrder).toContain("exceptions: measurementExceptions");
    expect(workOrder).toContain("TAYQAN_MEASUREMENT_LEASE_CODE");
    expect(workOrder).toContain("heartbeatTayqanMeasurementLease");
    expect(workOrder).toContain("TAYQAN_MEASUREMENT_EXCEPTION_REGISTER");
    expect(workOrder).toContain("exceptionRegisterRunId");
    expect(workOrder).toMatch(/prisma\.\$transaction\(async \(tx\)[\s\S]*tx\.tayqanWorkOrder\.updateMany[\s\S]*TAYQAN_MEASUREMENT_EXCEPTION_REGISTER[\s\S]*TAYQAN_MEASUREMENT_COMPLETE[\s\S]*maxWait: 10_000, timeout: 30_000/);
    expect(workOrder).toContain("measurement completion status update failed after durable commit");
    expect(workOrder).toContain('"measurement-checkpoint-commit"');
    expect(workOrder).toContain('"measurement-checkpoint-reload"');
    expect(workOrder).toContain("tx.tayqanWorkEvent.createMany");
    expect(workOrder).toContain("TAYQAN_AI_DRAFT_LEASE_CODE");
    expect(workOrder).toContain("advanceTayqanAiDraftWithLease");
  });

  it("serializes automatic work-order advancement so expensive Senior QS calls cannot overlap", () => {
    const panel = readFileSync("src/components/tayqan/tayqan-work-order-panel.tsx", "utf8");
    expect(panel).toContain("advanceInFlight.current");
    expect(panel).toContain(".finally(() =>");
  });

  it("starts a durable work order without synchronously running the full Senior QS pipeline", () => {
    const workOrder = readFileSync("src/lib/services/tayqan-work-order-service.ts", "utf8");
    expect(workOrder).not.toContain("return advanceTayqanWorkOrder(actor, project.slug, created.id);");
    expect(workOrder).toContain("return toState(await loadOrder(actor.companyId, created.id));");
  });

  it("defaults to GPT-5.6 while keeping Pro review an explicit runtime opt-in", () => {
    const service = readFileSync(
      "src/lib/services/tayqan-measurement-service.ts",
      "utf8",
    );
    expect(service).toContain('|| "gpt-5.6"');
    expect(service).toContain(
      'env.TAYQAN_SENIOR_PRO_MODE?.trim() === "1"',
    );
    expect(service).toContain("safetyIdentifier");
  });

  it("preserves normal Quantara inference while TAYQAN remains explicit", () => {
    const source = readFileSync(
      "src/lib/services/ai-draft-boq-service.ts",
      "utf8",
    );

    expect(source).toContain(
      "applyAiMeasurementSuggestion",
    );

    expect(source).toContain(
      "recommendMeasurementMethod",
    );

    expect(source).toContain(
      'quantityMode?: "EXTRACTION_ONLY" | "TAYQAN_MEASUREMENT_PROPOSAL"',
    );

    expect(source).toContain(
      "useQuantaraMeasurementIntelligence",
    );

    expect(source).toContain(
      "tayqanMeasurementByEntityId",
    );
  });

  it("confirms an accepted unchanged TAYQAN quantity as a calculation", () => {
    const source = readFileSync(
      "src/lib/services/ai-draft-boq-service.ts",
      "utf8",
    );

    expect(source).toContain(
      "tayqanCalculatedQuantity",
    );

    expect(source).toContain(
      "CONFIRMED_CALCULATION",
    );

    expect(source).toContain(
      "AI_DRAFT_TAYQAN_REVIEW",
    );

    expect(source).toContain(
      "TAYQAN_CALCULATION_CONFIRMATION_CONFLICT",
    );
  });

});
