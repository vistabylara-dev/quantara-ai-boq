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
});
