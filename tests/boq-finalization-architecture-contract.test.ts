import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("BOQ finalization architecture contract", () => {
  it("keeps one shared finalization policy in BOQ and verification responses", () => {
    const boqRepository = read("src/lib/repositories/boq-repository.ts");
    const verificationRepository = read("src/lib/repositories/verification-repository.ts");

    expect(boqRepository).toContain("evaluateBOQFinalizationGate({");
    expect(boqRepository).toContain("finalization,");
    expect(verificationRepository).toContain("evaluateBOQFinalizationGate({");
    expect(verificationRepository).toContain("lockEligible: gate.lockEligible");
  });

  it("always re-runs verification at the server lock boundary", () => {
    const lockRoute = read("src/app/api/boqs/[boqId]/lock/route.ts");
    const verificationCall = lockRoute.indexOf("await runBOQVerification(");
    const lockCall = lockRoute.indexOf("await lockBOQ(");

    expect(verificationCall).toBeGreaterThan(-1);
    expect(lockCall).toBeGreaterThan(verificationCall);
  });

  it("lets the final-pricing screen persist a newly selected unpriced mode before server verification", () => {
    const boqPage = read("src/app/projects/[projectId]/boq/page.tsx");

    expect(boqPage).toContain("const locked = await lockRevisionAndReturn(activeRevision)");
    expect(boqPage).toContain("if (!activeRevision || (requiresRates && !allRatesEntered)) return;");
    expect(boqPage).not.toContain("hasUnsavedChanges || (requiresRates && !allRatesEntered) || verificationBlocked");
    expect(boqPage).not.toContain("disabled={actionInProgress || hasUnsavedChanges || (requiresRates && !allRatesEntered) || verificationBlocked}");
  });

  it("does not offer proposal locking unless the shared gate approves it", () => {
    const proposalsPage = read("src/app/projects/[projectId]/proposals/page.tsx");

    expect(proposalsPage).toContain("boq.finalization?.lockEligible ? (");
    expect(proposalsPage).toContain("Review verification");
  });

  it("does not describe an unverified empty result as clean", () => {
    const verificationPage = read("src/app/projects/[projectId]/verification/page.tsx");

    expect(verificationPage).toContain("exceptions.length === 0 && !summary?.freshlyVerified");
    expect(verificationPage).toContain("exceptions.length === 0 && summary?.freshlyVerified");
  });

  it("keeps Documents on the shared gate and proposals free of draft evidence", () => {
    const documentsPage = read("src/app/projects/[projectId]/documents/page.tsx");
    const readiness = read("src/lib/workflow/document-readiness-state.ts");
    const generation = read("src/lib/services/document-generation-service.ts");
    const proposalService = read("src/lib/services/client-proposal-service.ts");

    expect(readiness).toContain("input.selectedBoq.finalization");
    expect(readiness).toContain('finalization.lockReason === "ESTIMATE_INTEGRITY_REQUIRED"');
    expect(generation).toContain("if (unresolvedCriticalCount > 0)");
    expect(proposalService).toContain("assertProposalDocumentEligible(doc)");
    expect(documentsPage).toContain("verificationReadyForGeneration");
    expect(documentsPage).toContain('readiness.state === "DRAFT_READY_TO_LOCK" || readiness.state === "DRAFT_INTEGRITY_REQUIRED"');
  });
});
