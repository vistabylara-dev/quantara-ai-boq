import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("TAYQAN advance route runtime contract", () => {
  const source = readFileSync(
    path.resolve(
      __dirname,
      "../src/app/api/projects/[projectId]/tayqan/work-order/advance/route.ts",
    ),
    "utf8",
  );

  it("keeps long-running recovery and senior-QS passes inside a five-minute function budget", () => {
    expect(source).toContain('export const runtime = "nodejs";');
    expect(source).toContain("export const maxDuration = 300;");
    expect(source).toContain("advanceTayqanWorkOrder(actor, projectId, input.workOrderId)");
  });

  it("surfaces unknown orchestration failures safely without changing the service error contract", () => {
    expect(source).toContain('if (!(error instanceof AppError))');
    expect(source).toContain('"TAYQAN_WORK_ORDER_UNEXPECTED_FAILURE"');
    expect(source).not.toContain('"TAYQAN_MEASUREMENT_WORK_ORDER_PERSISTENCE_FAILED"');
    expect(source).toContain("return handleApiError(error)");
  });
});
