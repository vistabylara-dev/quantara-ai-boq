import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Regression coverage for the second confirmed production root cause: pdf-
 * parse (and its pdfjs-dist/@napi-rs/canvas DOMMatrix polyfill chain) must
 * never be touched by a plain drawings LIST request — only by code paths
 * that actually process PDF bytes (upload, finalize). drawing-service.ts
 * used to `import { PDFParse } from "pdf-parse"` at module scope, so every
 * caller — including listProjectDrawings — paid that load. In the deployed
 * Vercel bundle, @napi-rs/canvas's dynamic require was invisible to output
 * file tracing, so the polyfill silently failed to install and the very
 * next line threw "DOMMatrix is not defined" before any route handler code
 * ran, turning a harmless list request into a 500.
 *
 * This test mocks "pdf-parse" to prove *when* it's touched, which is why it
 * lives in its own file rather than tests/drawing-upload.test.ts — that
 * file's own tests rely on real pdf-parse page-count extraction and would
 * break under this mock.
 */
const pdfParseConstructorSpy = vi.hoisted(() => vi.fn());
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(...args: unknown[]) {
      pdfParseConstructorSpy(...args);
    }
    async getInfo() {
      return { total: 3 };
    }
    async destroy() {}
  },
}));

import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { listProjectDrawings, uploadProjectDrawing } from "../src/lib/services/drawing-service";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = `${Date.now()}-${process.pid}-lazy-pdf`;

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

describe("Drawings list does not eagerly load pdf-parse", () => {
  let companyId: string;
  let projectId: string;
  let projectSlug: string;
  let ownerActor: CurrentActor;

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `Lazy PDF Co ${RUN_ID}`, tradeName: "Lazy PDF Co", email: `lazy-pdf-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Lazy PDF Client", email: `lazy-pdf-client-${RUN_ID}@example.com` });
    const ownerUser = await prisma.user.create({
      data: { companyId, email: `lazy-pdf-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner", email: ownerUser.email };

    const { project } = await createProjectWithDefaultBoq(ownerActor, {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `LAZY-PDF-${RUN_ID}`,
      name: "Lazy PDF Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = project.databaseId;
    projectSlug = project.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { companyId } });
    await prisma.projectFile.deleteMany({ where: { companyId } });
    await prisma.bOQItem.deleteMany({ where: { companyId } });
    await prisma.bOQSection.deleteMany({ where: { companyId } });
    await prisma.bOQ.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.client.deleteMany({ where: { companyId } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  });

  it("never constructs PDFParse for a list-only request, slug or UUID, empty or non-empty", async () => {
    pdfParseConstructorSpy.mockClear();

    await listProjectDrawings(ownerActor, projectSlug);
    expect(pdfParseConstructorSpy).not.toHaveBeenCalled();

    await uploadProjectDrawing(ownerActor, projectId, { originalName: "seed.pdf", mimeType: "application/pdf", buffer: pdfBuffer("seed content"), metadata: {} });
    pdfParseConstructorSpy.mockClear();

    await listProjectDrawings(ownerActor, projectSlug);
    await listProjectDrawings(ownerActor, projectId);
    expect(pdfParseConstructorSpy).not.toHaveBeenCalled();
  });

  it("does construct PDFParse when a PDF is actually uploaded — proving the lazy load still fires when genuinely needed", async () => {
    pdfParseConstructorSpy.mockClear();
    const result = await uploadProjectDrawing(ownerActor, projectSlug, { originalName: "real-upload.pdf", mimeType: "application/pdf", buffer: pdfBuffer("actually processed"), metadata: {} });
    expect(pdfParseConstructorSpy).toHaveBeenCalledTimes(1);
    expect(result.drawing.pageCount).toBe(3);
  });
});
