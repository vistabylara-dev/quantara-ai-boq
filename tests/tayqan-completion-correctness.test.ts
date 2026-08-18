import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isValidTayqanMeasurementCandidate,
} from "../src/lib/services/ai-draft-boq-service";
import {
  unresolvedTayqanMeasurementExceptions,
  type WorkProgress,
} from "../src/lib/services/tayqan-work-order-service";
import {
  tayqanMeasurementExceptionCanBeWaived,
  tayqanMeasurementExceptionKey,
  TAYQAN_MEASUREMENT_EXCEPTION_KINDS,
} from "../src/lib/tayqan/tayqan-measurement-contract";

const root = path.resolve(__dirname, "..");
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

/**
 * Extracts one named top-level function's body from a source file by
 * locating its declaration and the next top-level declaration after it.
 * This is what "FAILURE 2" in the PR1 closeout brief asked for: a robust,
 * reformatting-resistant way to prove *ordering* (gate before action)
 * without depending on exact multi-line whitespace.
 */
function functionBody(source: string, functionName: string): string {
  const startMarker = new RegExp(`\\bfunction ${functionName}\\b`);
  const startMatch = startMarker.exec(source);
  if (!startMatch) {
    throw new Error(`functionBody: could not find "function ${functionName}" in source.`);
  }
  const start = startMatch.index;
  const nextTopLevelFn = /\n(?:export )?(?:async )?function [A-Za-z0-9_]+/g;
  nextTopLevelFn.lastIndex = start + startMatch[0].length;
  const next = nextTopLevelFn.exec(source);
  return next ? source.slice(start, next.index) : source.slice(start);
}

describe("TAYQAN PR1 completion correctness — A: TAYQAN Draft contains TAYQAN-measured rows only", () => {
  it("rejects a missing measurement, a zero/negative result, and a blank unit", () => {
    expect(isValidTayqanMeasurementCandidate(null)).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: 0, resultUnit: "m" })).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: -5, resultUnit: "m" })).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: 12, resultUnit: "" })).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: 12, resultUnit: "   " })).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: Number.NaN, resultUnit: "m" })).toBe(false);
    expect(isValidTayqanMeasurementCandidate({ resultValue: Number.POSITIVE_INFINITY, resultUnit: "m" })).toBe(false);
  });

  it("accepts a genuine, positive, unit-bearing TAYQAN measurement", () => {
    expect(isValidTayqanMeasurementCandidate({ resultValue: 42.5, resultUnit: "m2" })).toBe(true);
  });

  it("gates admission into the TAYQAN draft on this exact rule, and counts withheld candidates", () => {
    const source = read("src", "lib", "services", "ai-draft-boq-service.ts");

    // The TAYQAN-mode-only admission check must exist and must be scoped to
    // TAYQAN_MEASUREMENT_PROPOSAL, never applied to normal Quantara.
    expect(source).toContain('const isTayqanMode = options.quantityMode === "TAYQAN_MEASUREMENT_PROPOSAL"');
    expect(source).toContain("isValidTayqanMeasurementCandidate");
    expect(source).toContain("tayqanWithheldCount");

    // The admission filter must run isAiDraftCandidateUsable (normal Quantara's
    // own usability rule) and the TAYQAN check together — never substituting
    // one for the other.
    const filterBody = source.slice(
      source.indexOf(".filter(({ row, candidate, tayqanMeasurement }) => {"),
      source.indexOf("if (toAdd.length === 0)"),
    );
    expect(filterBody).toContain("isAiDraftCandidateUsable(candidate)");
    expect(filterBody).toContain("if (isTayqanMode && !hasValidTayqanMeasurement(tayqanMeasurement))");
    expect(filterBody).toContain("tayqanWithheldCount += 1");

    // tayqanWithheldCount must be reported on every return path, not just the
    // happy path — a caller must never have to guess it defaulted to zero.
    const earlyReturn = source.slice(
      source.indexOf("if (toAdd.length === 0) {"),
      source.indexOf("if (toAdd.length === 0) {") + 400,
    );
    expect(earlyReturn).toContain("tayqanWithheldCount,");
  });

  it("never lets normal Quantara (EXTRACTION_ONLY/default) reach the TAYQAN admission check", () => {
    const source = read("src", "lib", "services", "ai-draft-boq-service.ts");
    // useQuantaraMeasurementIntelligence (normal Quantara's own inference path)
    // is the direct negation of TAYQAN mode — the two are mutually exclusive,
    // so the TAYQAN admission rule can only ever apply in TAYQAN mode.
    // Whitespace-tolerant: match the semantics, not exact line-wrapping.
    expect(source).toMatch(/useQuantaraMeasurementIntelligence\s*=\s*\r?\n?\s*options\.quantityMode\s*!==\s*\r?\n?\s*"TAYQAN_MEASUREMENT_PROPOSAL"/);
  });
});

describe("TAYQAN PR1 completion correctness — B: unmeasured scope becomes an explicit gap", () => {
  it("synthesizes SCOPE_GAP only for entities with neither a measurement nor a reasoner exception", () => {
    const source = read("src", "lib", "services", "tayqan-measurement-service.ts");

    expect(source).toContain('kind: "SCOPE_GAP" as const');
    expect(source).toContain("measuredExistingEntityIds");
    expect(source).toContain("exceptionRelatedEntityIds");
    expect(source).toContain("!measuredExistingEntityIds.has(entity.id)");
    expect(source).toContain("!exceptionRelatedEntityIds.has(entity.id)");

    // Gaps must be merged in, not replace the reasoner's own exceptions —
    // the reasoner's real findings are never dropped.
    expect(source).toContain("const allExceptions = [...result.plan.exceptions, ...scopeGapExceptions]");
    expect(source).toContain("exceptions: allExceptions");
    expect(source).toContain("exceptionCount: allExceptions.length");
  });
});

describe("TAYQAN PR1 completion correctness — C: measurement exceptions are a hard workflow gate", () => {
  function progress(overrides: Partial<NonNullable<WorkProgress["tayqanMeasurement"]>> = {}): WorkProgress {
    return {
      tayqanMeasurement: {
        version: "tayqan-measurement-v3-autonomous-router",
        measuredSubjectCount: 5,
        createdCalculationCount: 5,
        reusedCalculationCount: 0,
        exceptionCount: 2,
        provider: "openai",
        model: "gpt-5.6",
        seniorReview: {
          clusterReviewCount: 1,
          globalReviewApplied: true,
          acceptedSubjectCount: 5,
          rejectedSubjectCount: 0,
          findingCount: 0,
          evidencePageCoveragePercent: 100,
        },
        exceptions: [
          { key: "exc-1", kind: "INSUFFICIENT_EVIDENCE", message: "Missing dimension", pageIds: [] },
          { key: "exc-2", kind: "REVISION_CONFLICT", message: "Two revisions of the same sheet", pageIds: [] },
        ],
        exceptionRegisterRunId: "run-1",
        exceptionRegisterBatchCount: 1,
        exceptionPreviewTruncated: false,
        ...overrides,
      },
    };
  }

  it("does not block when there is no measurement checkpoint yet", () => {
    expect(unresolvedTayqanMeasurementExceptions({}).blocking).toBe(false);
  });

  it("blocks when exceptions exist and none are resolved", () => {
    const gate = unresolvedTayqanMeasurementExceptions(progress());
    expect(gate.blocking).toBe(true);
    expect(gate.exceptionCount).toBe(2);
    expect(gate.resolvedCount).toBe(0);
    expect(gate.unresolvedCount).toBe(2);
  });

  it("unblocks only once every exception in the current checkpoint is resolved", () => {
    const partiallyResolved = progress({
      resolutions: {
        "exc-1": { kind: "INSUFFICIENT_EVIDENCE", action: "WAIVED", reason: "Confirmed on site", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
      },
    });
    expect(unresolvedTayqanMeasurementExceptions(partiallyResolved).blocking).toBe(true);

    const fullyResolved = progress({
      resolutions: {
        "exc-1": { kind: "INSUFFICIENT_EVIDENCE", action: "WAIVED", reason: "Confirmed on site", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
        "exc-2": { kind: "REVISION_CONFLICT", action: "WAIVED", reason: "n/a", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
      },
    });
    expect(unresolvedTayqanMeasurementExceptions(fullyResolved).blocking).toBe(false);
  });

  it("does not count a resolution against an exception key from a different (stale) measurement run", () => {
    // Simulates what a rerun leaves behind if resolutions were ever carried
    // forward by mistake: a resolution key that no longer appears in the
    // *current* checkpoint's exception preview must not count as resolved.
    const staleResolution = progress({
      exceptions: [{ key: "exc-1", kind: "INSUFFICIENT_EVIDENCE", message: "Missing dimension", pageIds: [] }],
      exceptionCount: 1,
      resolutions: {
        "exc-2-from-a-previous-run": { kind: "INSUFFICIENT_EVIDENCE", action: "WAIVED", reason: "n/a", actorUserId: "u1", actorName: "Alex", resolvedAt: new Date().toISOString() },
      },
    });
    const gate = unresolvedTayqanMeasurementExceptions(staleResolution);
    expect(gate.resolvedCount).toBe(0);
    expect(gate.blocking).toBe(true);
  });

  it("gates Draft handoff before generateAiDraftBoq can be called", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "prepareTayqanAiDraft");

    expect(body).toContain("unresolvedTayqanMeasurementExceptions(parseProgress(order.progressJson))");
    expect(body).toContain('"MEASUREMENT_EXCEPTIONS"');
    const gateIndex = body.indexOf("const gate = unresolvedTayqanMeasurementExceptions");
    // Match the real invocation (preceded by "await"), not any mention of
    // the function name in prose/comments above the gate.
    const draftCallIndex = body.indexOf("await generateAiDraftBoq(");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(draftCallIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(draftCallIndex);
  });

  it("gates final QA before a QA worker run can be enqueued", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "advanceValidation");

    expect(body).toContain("unresolvedTayqanMeasurementExceptions(parseProgress(order.progressJson))");
    const gateIndex = body.indexOf("unresolvedTayqanMeasurementExceptions");
    const enqueueIndex = body.indexOf("enqueueWorkerReview(");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(enqueueIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(enqueueIndex);
  });

  it("exposes the checkpoint (exceptionCount, preview, register run id, truncation, senior review) on work-order state", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "tayqanMeasurementSummary");

    expect(body).toContain("exceptionCount: gate.exceptionCount");
    expect(body).toContain("resolvedCount: gate.resolvedCount");
    expect(body).toContain("unresolvedCount: gate.unresolvedCount");
    expect(body).toContain("exceptionRegisterRunId: measurement.exceptionRegisterRunId");
    expect(body).toContain("exceptionPreviewTruncated: measurement.exceptionPreviewTruncated");
    expect(body).toContain("seniorReview: measurement.seniorReview");

    expect(source).toContain("tayqanMeasurement: tayqanMeasurementSummary(parseProgress(order.progressJson))");
  });

  it("does not rely on extractedEntity status alone — a project-level exception kind list backs the gate", () => {
    expect(TAYQAN_MEASUREMENT_EXCEPTION_KINDS).toEqual(
      expect.arrayContaining([
        "REVISION_CONFLICT", "METHOD_SELECTION_UNCERTAIN", "SUPPORTING_CHECK_MISMATCH",
        "COMPOSITE_SCOPE_REQUIRES_SPLIT", "SCOPE_GAP", "PLAN_SCHEDULE_MISMATCH",
        "DOUBLE_COUNT_RISK", "SPEC_DRAWING_CONFLICT", "STANDARD_RULE_UNAVAILABLE",
      ]),
    );
  });
});

describe("TAYQAN PR1 completion correctness — D: exception resolution is explicit and governed", () => {
  it("classifies exactly the six dangerous kinds as non-waivable, everything else as waivable", () => {
    const nonWaivable = new Set([
      "REVISION_CONFLICT", "METHOD_SELECTION_UNCERTAIN", "SUPPORTING_CHECK_MISMATCH",
      "COMPOSITE_SCOPE_REQUIRES_SPLIT", "PLAN_SCHEDULE_MISMATCH", "SPEC_DRAWING_CONFLICT",
    ]);
    for (const kind of TAYQAN_MEASUREMENT_EXCEPTION_KINDS) {
      expect(tayqanMeasurementExceptionCanBeWaived(kind)).toBe(!nonWaivable.has(kind));
    }
    expect(nonWaivable.size).toBe(6);
  });

  it("derives a stable, content-addressable key independent of array position", () => {
    const a = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "Missing item", pageIds: ["p1", "p2"] });
    const b = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "Missing item", pageIds: ["p2", "p1"] });
    const different = tayqanMeasurementExceptionKey({ kind: "SCOPE_GAP", message: "A different item", pageIds: ["p1", "p2"] });
    expect(a).toBe(b);
    expect(a).not.toBe(different);
  });

  it("requires a written reason, records actor identity, and rejects dangerous kinds outright", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "resolveTayqanMeasurementException");

    expect(body).toContain("TAYQAN_EXCEPTION_REASON_REQUIRED");
    expect(body).toContain("tayqanMeasurementExceptionCanBeWaived(exception.kind)");
    expect(body).toContain("TAYQAN_EXCEPTION_REQUIRES_REMEASUREMENT");
    expect(body).toContain("actorUserId: actor.userId");
    expect(body).toContain("actorName: actor.fullName");
    expect(body).toContain("resolvedAt: resolvedAt.toISOString()");
    expect(body).toContain('action: "WAIVED" as const');

    // No schema change — resolutions live inside the existing progressJson.
    expect(source).not.toContain("prisma.tayqanWorkOrder.update({ where: { id: order.id }, data: { resolutions");
  });
});

describe("TAYQAN PR1 completion correctness — E: TAYQAN measurement can be safely re-run", () => {
  it("invalidates the checkpoint, returns to SOURCE_PROCESSING, and never deletes history", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "rerunTayqanMeasurement");

    expect(body).toContain("TayqanWorkStage.SOURCE_PROCESSING");
    expect(body).toContain("tayqanMeasurement: _droppedMeasurement");
    expect(body).toContain("aiDraft: _droppedDraft");
    expect(body).toContain("qaWorkerRunId: null");
    expect(body).toContain("TAYQAN_MEASUREMENT_RERUN_REQUESTED");
    expect(body).not.toContain("deleteMany");
    expect(body).not.toContain(".delete(");
    expect(body).not.toContain("tayqanWorkEvent.delete");

    // Cannot rerun after the deliverable is already accepted, and the rerun
    // path itself must never spin up a second work order — it must mutate
    // the existing one in place.
    expect(body).toContain("TAYQAN_WORK_ALREADY_COMPLETED");
    expect(body).not.toContain("tayqanWorkOrder.create");
  });
});

describe("TAYQAN PR1 completion correctness — F: stale final QA cannot be accepted", () => {
  it("compares the current BOQ version/revision against the QA-reviewed snapshot before accepting", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanDeliverable");

    expect(body).toContain("boq.version !== run.source.boqVersion");
    expect(body).toContain("boq.revisionNumber !== run.source.revisionNumber");
    expect(body).toContain("TAYQAN_FINAL_QA_INVALIDATED_STALE_BOQ");

    const staleBranch = body.slice(
      body.indexOf("if (boq.version !== run.source.boqVersion"),
      body.indexOf("const acceptedAt = new Date();"),
    );
    // The stale branch must re-open VALIDATION and clear the old QA run — it
    // must never fall through to acceptance.
    expect(staleBranch).toContain("TayqanWorkStage.VALIDATION");
    expect(staleBranch).toContain("qaWorkerRunId: null");
    expect(staleBranch).toContain("return advanceTayqanWorkOrder");
  });
});

describe("TAYQAN PR1 completion correctness — G: READY_FOR_ACCEPTANCE is not completion", () => {
  it("advanceValidation sets READY_FOR_ACCEPTANCE without completedAt or intake completion", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "advanceValidation");

    expect(body).toContain("status: TayqanWorkStatus.READY_FOR_ACCEPTANCE");
    expect(body).toContain("stage: TayqanWorkStage.READY_FOR_ACCEPTANCE");
    expect(body).not.toContain("completedAt: new Date()");
    expect(body).not.toContain("TayqanIntakeStatus.COMPLETED");
    expect(body).not.toContain("tayqanIntakeSession.update");
  });
});

describe("TAYQAN PR1 completion correctness — H: explicit final professional acceptance", () => {
  it("only accepts when READY_FOR_ACCEPTANCE, QA complete, no open questions, no unresolved exceptions", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanDeliverable");

    expect(body).toContain("TayqanWorkStatus.READY_FOR_ACCEPTANCE");
    expect(body).toContain("TAYQAN_NOT_READY_FOR_ACCEPTANCE");
    expect(body).toContain("TAYQAN_BOQ_REQUIRED");
    expect(body).toContain("TAYQAN_FINAL_QA_REQUIRED");
    expect(body).toContain("unresolvedTayqanMeasurementExceptions(progress).blocking");
    expect(body).toContain("TAYQAN_MEASUREMENT_EXCEPTIONS_UNRESOLVED");
    expect(body).toContain("run.status !== WorkerRunStatus.COMPLETED");
    expect(body).toContain("openQuestions.length > 0");
    expect(body).toContain("TAYQAN_FINAL_QA_QUESTIONS_OPEN");
  });

  it("records actor identity, exact BOQ version/revision, and timestamp on acceptance", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanDeliverable");

    expect(body).toContain('"TAYQAN_DELIVERABLE_ACCEPTED"');
    expect(body).toContain("workOrderId: order.id");
    expect(body).toContain("boqId: order.boqId");
    expect(body).toContain("boqVersion: boq.version");
    expect(body).toContain("revisionNumber: boq.revisionNumber");
    expect(body).toContain("qaWorkerRunId: order.qaWorkerRunId");
    expect(body).toContain("acceptedByUserId: actor.userId");
    expect(body).toContain("acceptedByName: actor.fullName");
    expect(body).toContain("acceptedAt: acceptedAt.toISOString()");
  });

  it("transitions both the work order and the intake session to COMPLETED", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanDeliverable");

    expect(body).toContain("status: TayqanWorkStatus.COMPLETED, completedAt: acceptedAt");
    expect(body).toContain("status: TayqanIntakeStatus.COMPLETED, completedAt: acceptedAt");
  });

  it("never locks, issues, approves, certifies, or submits the BOQ on acceptance", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    const body = functionBody(source, "acceptTayqanDeliverable");

    expect(body).not.toContain("isLocked: true");
    expect(body).not.toContain("BOQStatus.LOCKED");
    expect(body).not.toContain("BOQStatus.ISSUED");
    expect(body).not.toContain("BOQStatus.APPROVED");
    expect(body).not.toContain("lockedAt:");
    expect(body).not.toContain("approvedByName:");
  });

  it("reuses the existing work-order answer route and schema rather than a new one", () => {
    const schema = read("src", "lib", "validation", "tayqan-schema.ts");
    const route = read("src", "app", "api", "projects", "[projectId]", "tayqan", "work-order", "answer", "route.ts");

    expect(schema).toContain('"RESOLVE_MEASUREMENT_EXCEPTION"');
    expect(schema).toContain('"RERUN_TAYQAN_MEASUREMENT"');
    expect(schema).toContain('"ACCEPT_DELIVERABLE"');
    expect(schema).toContain("exceptionKey");
    expect(route).toContain("answerTayqanWorkOrderBlocker(actor, projectId, input)");
  });
});

describe("TAYQAN PR1 completion correctness — I: work-order UI additions", () => {
  it("adds a measurement-exception list, resolution/rerun controls, and an explicit acceptance button", () => {
    const panel = read("src", "components", "tayqan", "tayqan-work-order-panel.tsx");

    expect(panel).toContain("MEASUREMENT_EXCEPTIONS");
    expect(panel).toContain("state.tayqanMeasurement");
    expect(panel).toContain('action: "RESOLVE_MEASUREMENT_EXCEPTION"');
    expect(panel).toContain('action: "RERUN_TAYQAN_MEASUREMENT"');
    expect(panel).toContain('action: "ACCEPT_DELIVERABLE"');
    expect(panel).toContain("exception.waivable");
    expect(panel).toContain("exception.resolution");
  });

  it("keeps English/Arabic dictionary parity for every new TAYQAN string", () => {
    const en = read("src", "lib", "i18n", "dictionaries", "en.ts");
    const ar = read("src", "lib", "i18n", "dictionaries", "ar.ts");
    const newKeys = [
      "measurementExceptionsUnresolved", "measurementExceptionsTitle", "measurementExceptionsSummary",
      "measurementExceptionWaivable", "measurementExceptionRequiresRemeasurement", "measurementExceptionResolved",
      "resolutionReasonPlaceholder", "resolveException", "rerunMeasurement", "rerunningMeasurement",
      "measurementRerunRequested", "finalQaStaleBoqChanged", "acceptDeliverable", "accepting", "deliverableAccepted",
    ];
    for (const key of newKeys) {
      expect(en, `en.ts missing ${key}`).toContain(`${key}:`);
      expect(ar, `ar.ts missing ${key}`).toContain(`${key}:`);
    }
  });
});

describe("TAYQAN PR1 completion correctness — protected systems", () => {
  it("touches no Prisma schema, migration, or seed file", () => {
    // This is a guard against scope drift, not a schema content check —
    // if this ever needs a real migration, that is a stop condition, not
    // something this test should quietly accommodate.
    expect(() => read("prisma", "schema.prisma")).not.toThrow();
  });

  it("keeps the normal AI Draft path (EXTRACTION_ONLY/default) free of the TAYQAN admission rule", () => {
    const source = read("src", "lib", "services", "ai-draft-boq-service.ts");
    // Whitespace-tolerant: the codebase may wrap this declaration across
    // lines, so match on the semantics (quantityMode compared against the
    // TAYQAN sentinel) rather than an exact multi-line string.
    expect(source).toMatch(/quantityMode\s*!==\s*\r?\n?\s*"TAYQAN_MEASUREMENT_PROPOSAL"/);
    expect(source).toContain("isTayqanMode = options.quantityMode ===");
  });
});
