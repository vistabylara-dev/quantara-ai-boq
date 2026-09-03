import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("drawing finalization route contract", () => {
  it("acknowledges durable finalization with HTTP 202", () => {
    const source = readFileSync(path.join(
      process.cwd(),
      "src/app/api/projects/[projectId]/drawings/upload-authorization/[sessionId]/finalize/route.ts",
    ), "utf8");

    expect(source).toContain("return apiSuccess(result, 202)");
  });
});
