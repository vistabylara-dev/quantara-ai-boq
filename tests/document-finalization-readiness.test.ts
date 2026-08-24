import { describe, expect, it } from "vitest";
import { computeDocumentReadiness } from "@/lib/workflow/document-readiness-state";
import type { BOQ } from "@/types/boq";

function boq(finalization: NonNullable<BOQ["finalization"]>): BOQ {
  return {
    id: "boq-1", projectId: "project-1", title: "BOQ", revision: "R01", status: "draft", sections: [],
    totals: { directCost: 0, landedCost: 0, grossProfit: 0, grossMarginPercentage: 0, subtotal: 0, discountPercentage: 0, discountAmount: 0, taxableAmount: 0, taxAmount: 0, grandTotal: 0 },
    createdAt: new Date().toISOString(), finalization,
  };
}

const base = { freshlyVerified: true, unresolvedCritical: 0, unconfirmedItemCount: 0 };

describe("document finalization readiness", () => {
  it("never calls stale verification ready to lock", () => {
    const selectedBoq = boq({ ...base, freshlyVerified: false, lockEligible: false, lockReason: "VERIFICATION_STALE" });
    expect(computeDocumentReadiness({ selectedBoq, isLockedRevision: false, verification: { unresolvedCritical: 0, unresolvedWarning: 0 }, isGenerating: false }).state).toBe("DRAFT_UNVALIDATED");
  });

  it("never calls unconfirmed estimate evidence ready to lock", () => {
    const selectedBoq = boq({ ...base, lockEligible: false, lockReason: "ESTIMATE_INTEGRITY_REQUIRED", unconfirmedItemCount: 85 });
    const result = computeDocumentReadiness({ selectedBoq, isLockedRevision: false, verification: { unresolvedCritical: 0, unresolvedWarning: 0 }, isGenerating: false });
    expect(result).toMatchObject({ state: "DRAFT_INTEGRITY_REQUIRED", nextActionLabel: "Review BOQ evidence" });
    expect(result.why).toContain("85 item(s)");
  });

  it("uses the shared eligible state for lock readiness", () => {
    const selectedBoq = boq({ ...base, lockEligible: true, lockReason: null });
    expect(computeDocumentReadiness({ selectedBoq, isLockedRevision: false, verification: { unresolvedCritical: 0, unresolvedWarning: 0 }, isGenerating: false }).state).toBe("DRAFT_READY_TO_LOCK");
  });
});
