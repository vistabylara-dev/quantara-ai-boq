import { describe, expect, it } from "vitest";
import { buildQuickStartSteps } from "../src/components/dashboard/quick-start-workspace";

/**
 * Regression coverage for the production incident where the dashboard's
 * "Upload Drawings" quick-start card linked to /imports (the CSV/XLSX
 * spreadsheet importer) whenever no project was selected yet, which is how
 * a PDF ended up being processed as a spreadsheet import.
 */
describe("dashboard quick-start workspace — navigation contract", () => {
  it("never points Upload Drawings at /imports, with or without a selected project", () => {
    for (const projectId of [null, "proj-123"]) {
      const steps = buildQuickStartSteps(projectId);
      const uploadStep = steps.find((step) => step.title === "Upload Drawings");
      expect(uploadStep).toBeDefined();
      expect(uploadStep!.href).not.toBe("/imports");
      expect(uploadStep!.href).not.toMatch(/^\/imports(\/|$)/);
    }
  });

  it("routes Upload Drawings to the real project drawing uploader when a project is selected", () => {
    const steps = buildQuickStartSteps("proj-123");
    const uploadStep = steps.find((step) => step.title === "Upload Drawings");
    expect(uploadStep!.href).toBe("/projects/proj-123/drawings");
  });

  it("routes Upload Drawings to project creation (not /imports, not the legacy /files page) when no project is selected", () => {
    const steps = buildQuickStartSteps(null);
    const uploadStep = steps.find((step) => step.title === "Upload Drawings");
    expect(uploadStep!.href).toBe("/projects/new");
  });

  it("never links Upload Drawings at the legacy extraction-preview /files page", () => {
    for (const projectId of [null, "proj-123"]) {
      const steps = buildQuickStartSteps(projectId);
      const uploadStep = steps.find((step) => step.title === "Upload Drawings");
      expect(uploadStep!.href).not.toMatch(/\/files$/);
    }
  });
});
