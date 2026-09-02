import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTONOMOUS_PREPARATION_STAGES,
  deriveAutonomousPreparationUi,
} from "../src/lib/autonomous-boq/workflow-ui";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

describe("universal drawing-to-BOQ customer workflow UI", () => {
  it("derives every durable preparation state without asking for quantities", () => {
    expect(AUTONOMOUS_PREPARATION_STAGES.map((stage) => stage.label)).toEqual([
      "Uploading",
      "Reading drawings",
      "Detecting dimensions/schedules",
      "Calculating quantities",
      "Building BOQ",
      "Ready",
    ]);
    expect(deriveAutonomousPreparationUi({ drawingCount: 0, uploadActive: false, preparation: null }).state).toBe("empty");
    expect(deriveAutonomousPreparationUi({ drawingCount: 0, uploadActive: true, preparation: null }).state).toBe("uploading");
    expect(deriveAutonomousPreparationUi({ drawingCount: 1, uploadActive: false, preparation: { status: "RUNNING", stage: "MEASURING", readyForRates: false, retryable: false } }).state).toBe("processing");
    expect(deriveAutonomousPreparationUi({ drawingCount: 1, uploadActive: false, preparation: { status: "NEEDS_REVIEW", stage: "NEEDS_REVIEW", readyForRates: false, retryable: false } }).state).toBe("partially_ready");
    expect(deriveAutonomousPreparationUi({ drawingCount: 1, uploadActive: false, preparation: { status: "FAILED", stage: "FAILED", readyForRates: false, retryable: true } }).state).toBe("retryable_failure");
    expect(deriveAutonomousPreparationUi({ drawingCount: 1, uploadActive: false, preparation: { status: "NEEDS_INPUT", stage: "SOURCE_INPUT_REQUIRED", readyForRates: false, retryable: false } }).state).toBe("missing_evidence");
    expect(deriveAutonomousPreparationUi({ drawingCount: 1, uploadActive: false, preparation: { status: "COMPLETED", stage: "READY_FOR_RATES", readyForRates: true, retryable: false } }).state).toBe("ready");
  });

  it("limits project creation to truthful autonomous availability and continues to drawings", () => {
    const page = source("src/app/projects/new/page.tsx");
    const route = source("src/app/api/industries/route.ts");

    expect(page).toContain('"AUTONOMOUS_VERIFIED" | "SPECIALIZED_AUTONOMOUS"');
    expect(page).toContain("AUTONOMOUS_INDUSTRY_AVAILABILITY");
    expect(page).toContain("/drawings`");
    expect(page).not.toMatch(/name=["']quantity/);
    expect(page).not.toMatch(/name=["']dimension/);
    expect(route).toContain("autonomousAvailability");
    expect(route).toContain('"SPECIALIZED_AUTONOMOUS"');
  });

  it("shows durable stages, scoped review/retry actions and automatically opens the ready BOQ", () => {
    const page = source("src/app/projects/[projectId]/drawings/page.tsx");

    expect(page).toContain("AUTONOMOUS_PREPARATION_STAGES");
    expect(page).toContain("Generate BOQ from Drawings");
    expect(page).toContain("router.replace");
    expect(page).toContain("Replace or upload drawing");
    expect(page).toContain("Open engineering review");
    expect(page).toContain('aria-live="polite"');
    expect(page).not.toMatch(/name=["']quantity/);
    expect(page).not.toMatch(/name=["']dimension/);
  });

  it("keeps generated scope read-only, exposes missing rates and nests override behind evidence", () => {
    const editor = source("src/components/boq/rate-only-boq-editor.tsx");

    expect(editor).toContain("zero or missing rates remaining");
    expect(editor).toContain("Estimated total from entered rates");
    expect(editor).toContain("Request quantity override");
    expect(editor).toContain("Original AI quantity");
    expect(editor).toContain("/quantity-override");
    expect(editor).toContain("sessionStorage");
    expect(editor).toContain("beforeunload");
    expect(editor).not.toMatch(/name={`quantity/);
  });

  it("keeps finalization on verification-and-lock and continues to document outputs", () => {
    const boqPage = source("src/app/projects/[projectId]/boq/page.tsx");
    const lockRoute = source("src/app/api/boqs/[boqId]/lock/route.ts");
    const documentsPage = source("src/app/projects/[projectId]/documents/page.tsx");

    expect(boqPage).toContain("missingRateCount");
    expect(boqPage).toContain("critical verification");
    expect(boqPage).toContain("/documents`");
    expect(lockRoute).toContain("runBOQVerification");
    expect(lockRoute).toContain("lockBOQ");
    expect(documentsPage).toContain("generateError");
    expect(documentsPage).toContain('doc.status === "COMPLETED"');
  });
});
