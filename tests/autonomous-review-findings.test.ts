import { describe, expect, it } from "vitest";
import { consolidatePreparationFindings } from "../src/lib/autonomous-boq/review-findings";
import { assertAutonomousPreparationPayable } from "../src/lib/repositories/boq-repository";

describe("autonomous preparation review findings", () => {
  it("deduplicates equivalent cross-batch concept findings and combines source sheets", () => {
    const result = consolidatePreparationFindings([{
      code: "DOCUMENT_STATUS",
      message: "Batch 1: NOT FOR CONSTRUCTION basis of design only on page A-001.",
      sourceFileIds: ["file-1"], pageIds: ["page-1"], sourceSheets: ["A-001"], discipline: "Architectural", workPackage: "Area schedules",
    }, {
      code: "PAYABLE_SCOPE_UNSUPPORTED",
      message: "Senior checker: concept information cannot be used for payment, page A-002.",
      sourceFileIds: ["file-1"], pageIds: ["page-2"], sourceSheets: ["A-002"], discipline: "Architectural", workPackage: "Area schedules",
    }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: "CONCEPT_DRAWING_NOT_PAYABLE", sourceSheets: ["A-001", "A-002"], pageIds: ["page-1", "page-2"] });
  });

  it("is idempotent when the same retry findings are consolidated again", () => {
    const once = consolidatePreparationFindings([{ code: "MISSING_DIMENSION", message: "No structural dimensions were found.", sourceFileIds: ["file-1"], pageIds: ["page-1"] }]);
    expect(consolidatePreparationFindings([...once, ...once])).toEqual(once);
  });

  it("preserves alternatives and conflicts as distinct stable engineering problems", () => {
    const result = consolidatePreparationFindings([
      { code: "ALTERNATIVE_CONFIGURATION", message: "T, L and H schemes are alternatives.", sourceFileIds: ["file-1"] },
      { code: "VALUE_DISCREPANCY", message: "Gross area conflicts between sheets.", sourceFileIds: ["file-1"] },
    ]);
    expect(result.map((finding) => finding.code).sort()).toEqual(["ALTERNATIVE_SCHEME_UNRESOLVED", "DRAWING_VALUE_CONFLICT"]);
  });

  it("rejects payable lock for a concept schedule", () => {
    expect(() => assertAutonomousPreparationPayable({ payableEligibility: "NOT_PAYABLE_CONCEPT" })).toThrowError(expect.objectContaining({ code: "CONCEPT_BOQ_NOT_PAYABLE", status: 400 }));
    expect(() => assertAutonomousPreparationPayable({ payableEligibility: "PAYABLE_ELIGIBLE" })).not.toThrow();
  });
});
