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
});
