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

  it("discovers server-owned incomplete uploads after browser refresh", () => {
    const route = readFileSync(path.join(
      process.cwd(),
      "src/app/api/projects/[projectId]/drawings/upload-authorization/route.ts",
    ), "utf8");
    const page = readFileSync(path.join(
      process.cwd(),
      "src/app/projects/[projectId]/drawings/page.tsx",
    ), "utf8");

    expect(route).toContain("listRecoverableDrawingUploads");
    expect(route).toContain("export const GET");
    expect(page).toContain("Resume upload finalization");
    expect(page).toContain("canResumeFinalization");
    expect(page).not.toContain("localStorage.setItem");
    expect(page).not.toContain("sessionStorage.setItem");
  });
});
