import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("source processing UI recovery", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../src/app/projects/[projectId]/files/page.tsx"),
    "utf8",
  );

  it("polls the real extraction job instead of assuming 800ms is enough", () => {
    expect(source).not.toContain("setTimeout(resolve, 800)");
    expect(source).toContain("/jobs");
    expect(source).toContain("SETTLED_JOB_STATUSES");
    expect(source).toContain("JOB_POLL_TIMEOUT_MS");
  });

  it("shows independent source-processing actions", () => {
    expect(source).toContain("DOCUMENT_CLASSIFICATION");
    expect(source).toContain("FILE_PREPROCESSING");
    expect(source).toContain("TABLE_EXTRACTION");
    expect(source).toContain("Detect Schedule Tables");
    expect(source).toContain("currentJobStatusesByEngine");
  });

  it("does not render the raw queue exception message to the customer", () => {
    expect(source).toContain("safeJobFailureMessage");
    expect(source).not.toContain("{activeJob.errorMessage}");
    expect(source).toContain("provide the error code to support");
  });

  it("states the actual limitation of schedule-table detection", () => {
    expect(source).toContain("does not perform OCR or automatic drawing takeoff");
    expect(source).toContain("does not remove successfully rendered pages");
  });
});
