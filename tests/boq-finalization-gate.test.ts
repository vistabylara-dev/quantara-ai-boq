import { describe, expect, it } from "vitest";
import { evaluateBOQFinalizationGate } from "@/lib/boq/finalization-gate";

const confirmedItem = { status: "CONFIRMED", quantityConfirmed: true, rateConfirmed: true };

describe("BOQ finalization gate", () => {
  it("never treats old exception counts as current after the BOQ changes", () => {
    const gate = evaluateBOQFinalizationGate({
      isLocked: false, version: 8, verifiedVersion: 7, verifiedAt: new Date(), unresolvedCritical: 0, items: [confirmedItem],
    });
    expect(gate).toMatchObject({ lockEligible: false, freshlyVerified: false, lockReason: "VERIFICATION_STALE" });
  });

  it("blocks unresolved critical exceptions", () => {
    const gate = evaluateBOQFinalizationGate({
      isLocked: false, version: 8, verifiedVersion: 8, verifiedAt: new Date(), unresolvedCritical: 1, items: [confirmedItem],
    });
    expect(gate).toMatchObject({ lockEligible: false, lockReason: "UNRESOLVED_CRITICAL_EXCEPTIONS" });
  });

  it("blocks unconfirmed estimate evidence even after clean verification", () => {
    const gate = evaluateBOQFinalizationGate({
      isLocked: false, version: 8, verifiedVersion: 8, verifiedAt: new Date(), unresolvedCritical: 0,
      items: [{ status: "DRAFT", quantityConfirmed: false, rateConfirmed: false }],
    });
    expect(gate).toMatchObject({ lockEligible: false, lockReason: "ESTIMATE_INTEGRITY_REQUIRED", unconfirmedItemCount: 1 });
  });

  it("allows only a current, clean, fully confirmed revision", () => {
    const gate = evaluateBOQFinalizationGate({
      isLocked: false, version: 8, verifiedVersion: 8, verifiedAt: new Date(), unresolvedCritical: 0, items: [confirmedItem],
    });
    expect(gate).toMatchObject({ lockEligible: true, lockReason: null, freshlyVerified: true });
  });

  it("allows an unpriced revision when quantity evidence is confirmed and rate confirmation is not required", () => {
    const gate = evaluateBOQFinalizationGate({
      isLocked: false, version: 8, verifiedVersion: 8, verifiedAt: new Date(), unresolvedCritical: 0,
      items: [{ status: "CONFIRMED", quantityConfirmed: true, rateConfirmed: false, rateConfirmationRequired: false }],
    });
    expect(gate).toMatchObject({ lockEligible: true, lockReason: null, unconfirmedItemCount: 0 });
  });
});
