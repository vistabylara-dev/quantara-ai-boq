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

  it("keeps full-object checksum work outside the finalization request", () => {
    const service = readFileSync(path.join(process.cwd(), "src/lib/services/drawing-service.ts"), "utf8");
    const preprocessing = readFileSync(path.join(process.cwd(), "src/lib/files/preprocessing-handler.ts"), "utf8");

    expect(service).not.toContain("computeStreamedChecksum");
    expect(service).not.toContain('await import("@/lib/jobs/register-handlers")');
    expect(service).toContain('const checksum = `pending:');
    expect(preprocessing).toContain("computeDurableChecksum");
    expect(preprocessing).toContain("data: { checksum }");

    const queue = readFileSync(path.join(process.cwd(), "src/lib/jobs/local-job-queue.ts"), "utf8");
    expect(queue).toContain('after(async () =>');
    expect(queue).toContain('await import("@/lib/jobs/register-handlers")');
  });

  it("keeps finalization off interactive transactions on Preview database adapters", () => {
    const service = readFileSync(path.join(process.cwd(), "src/lib/services/drawing-service.ts"), "utf8");

    const finalization = service.slice(service.indexOf("export async function finalizeDrawingUpload"));
    expect(finalization).not.toContain("prisma.$transaction(");
    expect(finalization).toContain("const created = await createProjectFile(actor.companyId");
    expect(finalization).toContain('await setUploadSessionStatus(session.id, "FINALIZED", new Date())');
    expect(finalization).toContain("await ensureDrawingUploadedAudit(prisma, actor.companyId, created)");
  });

  it("does not await remote stream cancellation after reading the PDF signature", () => {
    const service = readFileSync(path.join(process.cwd(), "src/lib/services/drawing-service.ts"), "utf8");
    const adapter = readFileSync(path.join(process.cwd(), "src/lib/storage/vercel-blob-storage-adapter.ts"), "utf8");

    expect(service).toContain("void reader.cancel().catch(() => undefined)");
    expect(service).not.toContain("await reader.cancel()");
    expect(adapter).toContain("![200, 206].includes(response.statusCode)");
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
