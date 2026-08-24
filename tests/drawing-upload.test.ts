import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const currentActorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: currentActorMock,
}));

// vi.spyOn directly on `prisma.projectFile.create` is unsafe — Prisma Client
// methods are backed by internal Proxies, and mockRestore() on a Proxied
// property does not reliably put the original method back, breaking every
// later test in the file. Spying on the repository function instead (a
// plain exported function) avoids touching Prisma's internals at all; it
// defaults to the real implementation and only a single test overrides it.
const createProjectFileSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/repositories/project-file-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/repositories/project-file-repository")>();
  createProjectFileSpy.mockImplementation(actual.createProjectFile);
  return { ...actual, createProjectFile: createProjectFileSpy };
});

import { GET as drawingDetailGET, PATCH as drawingPATCH, DELETE as drawingDELETE } from "../src/app/api/drawings/[fileId]/route";
import { GET as drawingsListGET, POST as drawingsPOST } from "../src/app/api/projects/[projectId]/drawings/route";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  archiveProjectDrawing,
  getProjectDrawing,
  listProjectDrawings,
  updateProjectDrawingMetadata,
  uploadProjectDrawing,
} from "../src/lib/services/drawing-service";
import { getProjectFileForStreamingDownload } from "../src/lib/services/project-file-service";
import { DRAWING_UPLOAD_MAX_BYTES_DEFAULT } from "../src/lib/validation/drawing-schema";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";
import { AppError, NotFoundError, PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import PDFDocument from "pdfkit";

const RUN_ID = Date.now();

async function readStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

/** A real, valid, generated (never a confidential sample) multi-page PDF — proves page-count extraction against actual PDF structure, not a fake header. */
function generateRealPdf(pageCount: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (let i = 1; i <= pageCount; i += 1) {
      doc.addPage();
      doc.text(`Test fixture page ${i} of ${pageCount}`);
    }
    doc.end();
  });
}

describe("Drawing upload & intake pipeline (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
  let projectASlug: string;
  let ownerActorA: CurrentActor;
  let designerActorA: CurrentActor;
  let reviewerActorA: CurrentActor;
  let ownerActorB: CurrentActor;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const companyA = await prisma.company.create({
      data: { legalName: `Drawing Test Co A ${RUN_ID}`, tradeName: "Drawing Co A", email: `drawing-a-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    cleanupCompanyIds.push(companyAId);
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    const clientA = await createClient(companyAId, { name: "Drawing Client A", email: `drawing-client-a-${RUN_ID}@example.com` });

    const ownerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `drawing-owner-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    const designerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `drawing-designer-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Designer A", role: UserRole.DESIGNER, isActive: true, emailVerifiedAt: new Date() },
    });
    const reviewerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `drawing-reviewer-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Reviewer A", role: UserRole.REVIEWER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorA = { userId: ownerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner A", email: ownerUserA.email };
    designerActorA = { userId: designerUserA.id, companyId: companyAId, role: UserRole.DESIGNER, fullName: "Designer A", email: designerUserA.email };
    reviewerActorA = { userId: reviewerUserA.id, companyId: companyAId, role: UserRole.REVIEWER, fullName: "Reviewer A", email: reviewerUserA.email };

    const { project } = await createProjectWithDefaultBoq(ownerActorA, {
      clientId: clientA.id,
      industryEngineId: "construction",
      reference: `DRAW-A-${RUN_ID}`,
      name: "Drawing Test Project A",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;
    projectASlug = project.id;

    const companyB = await prisma.company.create({
      data: { legalName: `Drawing Test Co B ${RUN_ID}`, tradeName: "Drawing Co B", email: `drawing-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    cleanupCompanyIds.push(companyBId);
    const ownerUserB = await prisma.user.create({
      data: { companyId: companyBId, email: `drawing-owner-b-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorB = { userId: ownerUserB.id, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Owner B", email: ownerUserB.email };
  });

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.projectFileArchive.deleteMany({ where: { companyId } });
      await prisma.projectFile.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
  });

  beforeEach(() => {
    currentActorMock.mockReset();
  });

  describe("upload validation", () => {
    it("rejects a renamed non-PDF on the server-buffered upload path", async () => {
      await expect(uploadProjectDrawing(ownerActorA, projectAId, {
        originalName: "renamed.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
        metadata: {},
      })).rejects.toMatchObject({ code: "UNSAFE_FILE_CONTENT" });
    });

    it("rejects an unsupported extension", async () => {
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, { originalName: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x"), metadata: {} }),
      ).rejects.toMatchObject({ code: "FILE_TYPE_NOT_SUPPORTED" });
    });

    it("rejects a MIME type that does not match the extension", async () => {
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, { originalName: "plan.pdf", mimeType: "image/png", buffer: pdfBuffer("x"), metadata: {} }),
      ).rejects.toMatchObject({ code: "FILE_MIME_MISMATCH" });
    });

    it("rejects an empty file", async () => {
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, { originalName: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0), metadata: {} }),
      ).rejects.toMatchObject({ code: "FILE_EMPTY" });
    });

    it("rejects a file over the 250MB drawing-specific limit", async () => {
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, {
          originalName: "huge.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.alloc(DRAWING_UPLOAD_MAX_BYTES_DEFAULT + 1),
          metadata: {},
        }),
      ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    });

    it("trusts DWG/DXF/IFC/RVT extensions regardless of the browser-supplied MIME type, and accepts ZIP", async () => {
      for (const [name, mime] of [
        ["model.dwg", "application/octet-stream"],
        ["layout.dxf", "application/octet-stream"],
        ["building.ifc", "application/octet-stream"],
        ["model.rvt", "application/octet-stream"],
        ["archive.zip", "application/zip"],
      ] as const) {
        const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: name, mimeType: mime, buffer: Buffer.from("binary content"), metadata: {} });
        expect(result.drawing.status).toBe("UPLOADED");
        expect(result.drawing.previewAvailable).toBe(false);
        expect(result.drawing.analysisStatus).toBe("NOT_CONFIGURED");
      }
    });

    it("sanitizes a path-traversal-style original filename into a safe storage key", async () => {
      const result = await uploadProjectDrawing(ownerActorA, projectAId, {
        originalName: "../../../etc/passwd.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer("traversal attempt"),
        metadata: {},
      });
      expect(result.drawing.id).toBeTruthy();
      // The stored bytes must still be readable back through the tenant-scoped download path.
      const download = await getProjectFileForStreamingDownload(ownerActorA, result.drawing.id);
      const body = await readStreamToBuffer(download.body);
      expect(body.toString()).toBe(pdfBuffer("traversal attempt").toString());
    });

    it("gives two drawings with the identical original filename distinct, non-colliding storage keys", async () => {
      const bufferA = pdfBuffer("first same-name file");
      const bufferB = pdfBuffer("second same-name file");
      const first = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "same-name.pdf", mimeType: "application/pdf", buffer: bufferA, metadata: {} });
      const second = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "same-name.pdf", mimeType: "application/pdf", buffer: bufferB, metadata: {} });
      expect(first.drawing.id).not.toBe(second.drawing.id);

      const downloadA = await getProjectFileForStreamingDownload(ownerActorA, first.drawing.id);
      const downloadB = await getProjectFileForStreamingDownload(ownerActorA, second.drawing.id);
      expect((await readStreamToBuffer(downloadA.body)).toString()).toBe(bufferA.toString());
      expect((await readStreamToBuffer(downloadB.body)).toString()).toBe(bufferB.toString());
    });

    it("saves a real sha256 checksum", async () => {
      const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "checksum-test.pdf", mimeType: "application/pdf", buffer: pdfBuffer("checksum content"), metadata: {} });
      expect(result.drawing.checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("classification metadata", () => {
    it("persists discipline, drawing type, and optional metadata exactly as submitted — never inferred from the filename", async () => {
      const result = await uploadProjectDrawing(ownerActorA, projectAId, {
        originalName: "random-filename-123.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer("classified content"),
        metadata: {
          discipline: "MECHANICAL",
          drawingType: "FLOOR_PLAN",
          drawingNumber: "M-101",
          title: "Ground Floor Mechanical Layout",
          revision: "P2",
          issueDate: "2026-08-01",
          scale: "1:100",
          sheetNumber: "M-101",
          preparedBy: "J. Smith",
          checkedBy: "A. Lee",
          approvedBy: "R. Patel",
          notes: "Coordination pending with electrical.",
        },
      });

      expect(result.drawing.discipline).toBe("MECHANICAL");
      expect(result.drawing.drawingType).toBe("FLOOR_PLAN");
      expect(result.drawing.drawingNumber).toBe("M-101");
      expect(result.drawing.drawingTitle).toBe("Ground Floor Mechanical Layout");
      expect(result.drawing.revisionNumber).toBe("P2");
      expect(result.drawing.scaleText).toBe("1:100");
      expect(result.drawing.preparedBy).toBe("J. Smith");
      // Never derived from "random-filename-123.pdf".
      expect(result.drawing.drawingTitle).not.toContain("random-filename");
    });

    it("updates classification metadata after upload and records an audit event", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "update-me.pdf", mimeType: "application/pdf", buffer: pdfBuffer("update content"), metadata: { discipline: "ARCHITECTURAL" } });
      const updated = await updateProjectDrawingMetadata(ownerActorA, uploaded.drawing.id, { discipline: "STRUCTURAL", revision: "P3" });
      expect(updated.discipline).toBe("STRUCTURAL");
      expect(updated.revisionNumber).toBe("P3");

      const events = await prisma.auditLog.findMany({ where: { companyId: companyAId, entityId: uploaded.drawing.id, action: "DRAWING_METADATA_UPDATED" } });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("PDF page-count extraction (real, deterministic — CONFIRMED, never inferred)", () => {
    it("extracts the real page count from a valid multi-page PDF", async () => {
      const buffer = await generateRealPdf(11);
      const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "eleven-pages.pdf", mimeType: "application/pdf", buffer, metadata: {} });
      expect(result.drawing.pageCount).toBe(11);
    });

    it("extracts a different real page count for a differently-sized PDF", async () => {
      const buffer = await generateRealPdf(5);
      const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "five-pages.pdf", mimeType: "application/pdf", buffer, metadata: {} });
      expect(result.drawing.pageCount).toBe(5);
    });

    it("never fails the upload when page-count extraction can't parse the bytes — pageCount is a nice-to-have, not a gate", async () => {
      const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "not-really-a-pdf.pdf", mimeType: "application/pdf", buffer: pdfBuffer("not real pdf structure"), metadata: {} });
      expect(result.drawing.status).toBe("UPLOADED");
      expect(result.drawing.pageCount).toBeNull();
    });

    it("does not attempt page-count extraction for non-PDF drawings", async () => {
      const result = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "image.png", mimeType: "image/png", buffer: Buffer.from("fake png bytes"), metadata: {} });
      expect(result.drawing.pageCount).toBeNull();
    });
  });

  describe("preview availability (truthful, never fabricated)", () => {
    it("marks PDF and image drawings as preview-available", async () => {
      const pdf = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "preview.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} });
      expect(pdf.drawing.previewAvailable).toBe(true);

      const png = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "preview.png", mimeType: "image/png", buffer: Buffer.from("fake png bytes"), metadata: {} });
      expect(png.drawing.previewAvailable).toBe(true);
    });

    it("marks CAD/BIM/archive drawings as not preview-available, with analysis explicitly not configured — never a fake preview", async () => {
      const dwg = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "model.dwg", mimeType: "application/octet-stream", buffer: Buffer.from("cad bytes"), metadata: {} });
      expect(dwg.drawing.previewAvailable).toBe(false);
      expect(dwg.drawing.analysisStatus).toBe("NOT_CONFIGURED");
      expect(dwg.drawing.securityScanStatus).toBe("NOT_CONFIGURED");
    });
  });

  describe("RBAC + tenant isolation", () => {
    it("rejects upload from a role without the files:manage capability", async () => {
      await expect(
        uploadProjectDrawing(reviewerActorA, projectAId, { originalName: "plan.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("allows upload from a role that holds files:manage (DESIGNER)", async () => {
      const result = await uploadProjectDrawing(designerActorA, projectAId, { originalName: "designer-drawing.pdf", mimeType: "application/pdf", buffer: pdfBuffer("designer content"), metadata: {} });
      expect(result.drawing.status).toBe("UPLOADED");
    });

    it("allows read (list/detail) from a role without files:manage", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "readable.pdf", mimeType: "application/pdf", buffer: pdfBuffer("readable content"), metadata: {} });
      const list = await listProjectDrawings(reviewerActorA, projectAId);
      expect(list.some((d) => d.id === uploaded.drawing.id)).toBe(true);
      const detail = await getProjectDrawing(reviewerActorA, uploaded.drawing.id);
      expect(detail.id).toBe(uploaded.drawing.id);
    });

    it("enforces tenant isolation on read, download, update, and archive", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "tenant-isolation.pdf", mimeType: "application/pdf", buffer: pdfBuffer("tenant isolation content"), metadata: {} });

      await expect(getProjectDrawing(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
      await expect(getProjectFileForStreamingDownload(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
      await expect(updateProjectDrawingMetadata(ownerActorB, uploaded.drawing.id, { discipline: "CIVIL" })).rejects.toThrow(NotFoundError);
      await expect(archiveProjectDrawing(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
    });

    it("denies a guessed/nonexistent drawing ID with the same NotFoundError as a real cross-tenant ID (no existence leak)", async () => {
      await expect(getProjectDrawing(ownerActorA, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundError);
    });

    it("separates routine drawing management from destructive archive authority", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "protected.pdf", mimeType: "application/pdf", buffer: pdfBuffer("protected content"), metadata: {} });
      expect((await listProjectDrawings(ownerActorA, projectAId)).find((drawing) => drawing.id === uploaded.drawing.id)).toMatchObject({ canArchive: true });
      expect((await listProjectDrawings(designerActorA, projectAId)).find((drawing) => drawing.id === uploaded.drawing.id)).toMatchObject({ canArchive: false });
      await expect(archiveProjectDrawing(designerActorA, uploaded.drawing.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("archives a drawing while retaining its row and source bytes", async () => {
      const sourceBytes = pdfBuffer("retain drawing");
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "to-archive.pdf", mimeType: "application/pdf", buffer: sourceBytes, metadata: {} });
      const stored = await prisma.projectFile.findUniqueOrThrow({ where: { id: uploaded.drawing.id } });

      const archived = await archiveProjectDrawing(ownerActorA, uploaded.drawing.id);

      expect(archived).toMatchObject({ id: uploaded.drawing.id, status: "ARCHIVED", isArchived: true });
      expect((await getProjectDrawing(ownerActorA, uploaded.drawing.id)).isArchived).toBe(true);
      expect((await listProjectDrawings(ownerActorA, projectAId)).some((drawing) => drawing.id === uploaded.drawing.id)).toBe(false);
      const download = await getProjectFileForStreamingDownload(ownerActorA, uploaded.drawing.id);
      expect((await readStreamToBuffer(download.body)).equals(sourceBytes)).toBe(true);
      expect(await localProjectFileStorageAdapter.objectExists(stored.storageKey)).toBe(true);
      await expect(prisma.projectFile.delete({ where: { id: uploaded.drawing.id } })).rejects.toThrow();
    });
  });

  describe("atomicity — Blob/DB consistency", () => {
    it("does not create a database row when the Blob upload itself fails, and records a failure audit event", async () => {
      const putSpy = vi.spyOn(localProjectFileStorageAdapter, "putObject").mockRejectedValueOnce(new Error("simulated blob outage"));

      const beforeCount = await prisma.projectFile.count({ where: { companyId: companyAId } });
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, { originalName: "blob-fail.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} }),
      ).rejects.toThrow("simulated blob outage");
      const afterCount = await prisma.projectFile.count({ where: { companyId: companyAId } });
      expect(afterCount).toBe(beforeCount);

      const failureEvents = await prisma.auditLog.findMany({ where: { companyId: companyAId, action: "DRAWING_UPLOAD_FAILED" } });
      expect(failureEvents.some((e) => (e.payloadJson as { stage?: string })?.stage === "blob_put")).toBe(true);
      putSpy.mockRestore();
    });

    it("deletes the just-uploaded Blob object when the database write fails after a successful upload", async () => {
      const deleteSpy = vi.spyOn(localProjectFileStorageAdapter, "deleteObject");
      createProjectFileSpy.mockImplementationOnce(() => {
        throw new Error("simulated db outage");
      });

      const beforeCount = await prisma.projectFile.count({ where: { companyId: companyAId } });
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, { originalName: "db-fail.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} }),
      ).rejects.toThrow("simulated db outage");
      const afterCount = await prisma.projectFile.count({ where: { companyId: companyAId } });
      expect(afterCount).toBe(beforeCount);

      expect(deleteSpy).toHaveBeenCalledTimes(1);

      const failureEvents = await prisma.auditLog.findMany({ where: { companyId: companyAId, action: "DRAWING_UPLOAD_FAILED" } });
      expect(failureEvents.some((e) => (e.payloadJson as { stage?: string })?.stage === "db_write")).toBe(true);

      deleteSpy.mockRestore();
    });
  });

  describe("duplicate detection (explicit policy — never silently overwritten)", () => {
    it("flags a same-checksum re-upload of the same drawing without blocking or overwriting the original", async () => {
      const bytes = pdfBuffer("identical drawing content for duplicate test");
      const first = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "rev-a.pdf", mimeType: "application/pdf", buffer: bytes, metadata: {} });
      expect(first.duplicateOfFileId).toBeNull();

      const second = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "rev-b.pdf", mimeType: "application/pdf", buffer: bytes, metadata: {} });
      expect(second.duplicateOfFileId).toBe(first.drawing.id);
      // Both records exist independently — the original is never overwritten or deleted.
      expect(await getProjectDrawing(ownerActorA, first.drawing.id)).toBeTruthy();
      expect(await getProjectDrawing(ownerActorA, second.drawing.id)).toBeTruthy();
    });

    it("does not flag two different files with the same filename but different checksums as duplicates", async () => {
      const first = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "revision.pdf", mimeType: "application/pdf", buffer: pdfBuffer("version one"), metadata: {} });
      const second = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "revision.pdf", mimeType: "application/pdf", buffer: pdfBuffer("version two — materially different"), metadata: {} });
      expect(second.duplicateOfFileId).toBeNull();
      expect(first.drawing.checksum).not.toBe(second.drawing.checksum);
    });
  });

  describe("missing Blob object with an existing DB record", () => {
    it("fails safely (does not crash, does not fabricate content) when the stored object is gone but the database row remains", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "orphaned.pdf", mimeType: "application/pdf", buffer: pdfBuffer("will be deleted out of band"), metadata: {} });
      // Simulate the object having been removed directly from storage, out of band from the app (e.g. manual Blob console deletion).
      const row = await prisma.projectFile.findUniqueOrThrow({ where: { id: uploaded.drawing.id } });
      await localProjectFileStorageAdapter.deleteObject(row.storageKey);

      await expect(getProjectFileForStreamingDownload(ownerActorA, uploaded.drawing.id)).rejects.toThrow();
      // The database record itself is still readable — only the byte fetch fails, not the metadata layer.
      expect(await getProjectDrawing(ownerActorA, uploaded.drawing.id)).toBeTruthy();
    });
  });

  describe("no secrets or storage internals leaked to the client", () => {
    it("never returns a storageKey, Blob token, or Blob URL in the drawing DTO", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "no-leak.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} });
      const serialized = JSON.stringify(uploaded.drawing);
      expect(serialized).not.toMatch(/storageKey/i);
      expect(serialized).not.toMatch(/vercel-storage\.com/i);
      expect(serialized).not.toMatch(/blob:https?:\/\//i);
    });
  });

  describe("API route boundary", () => {
    it("rejects the list/upload/detail/update/delete routes with 401 when there is no authenticated session", async () => {
      currentActorMock.mockRejectedValue(new UnauthorizedError());

      const listResponse = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: projectAId }) });
      expect(listResponse.status).toBe(401);

      const formData = new FormData();
      formData.set("file", new File([pdfBuffer("x")], "route.pdf", { type: "application/pdf" }));
      const uploadRequest = new Request("http://localhost/api/projects/x/drawings", { method: "POST", body: formData });
      const uploadResponse = await drawingsPOST(uploadRequest, { params: Promise.resolve({ projectId: projectAId }) });
      expect(uploadResponse.status).toBe(401);

      const fakeId = "00000000-0000-0000-0000-000000000001";
      expect((await drawingDetailGET(new Request("http://localhost/api/drawings/x"), { params: Promise.resolve({ fileId: fakeId }) })).status).toBe(401);
      expect((await drawingPATCH(new Request("http://localhost/api/drawings/x", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ fileId: fakeId }) })).status).toBe(401);
      expect((await drawingDELETE(new Request("http://localhost/api/drawings/x"), { params: Promise.resolve({ fileId: fakeId }) })).status).toBe(401);
    });

    it("uploads a drawing end-to-end through the real route handler and lists it back", async () => {
      currentActorMock.mockResolvedValue(ownerActorA);

      const formData = new FormData();
      formData.set("file", new File([pdfBuffer("route upload content")], "route-upload.pdf", { type: "application/pdf" }));
      formData.set("discipline", "ELECTRICAL");
      formData.set("drawingType", "SINGLE_LINE_DIAGRAM");

      const uploadResponse = await drawingsPOST(
        new Request("http://localhost/api/projects/x/drawings", { method: "POST", body: formData }),
        { params: Promise.resolve({ projectId: projectAId }) },
      );
      expect(uploadResponse.status).toBe(201);
      const uploadBody = (await uploadResponse.json()) as { ok: boolean; data: { drawing: { id: string; discipline: string } } };
      expect(uploadBody.ok).toBe(true);
      expect(uploadBody.data.drawing.discipline).toBe("ELECTRICAL");

      const listResponse = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: projectAId }) });
      const listBody = (await listResponse.json()) as { ok: boolean; data: Array<{ id: string }> };
      expect(listBody.data.some((d) => d.id === uploadBody.data.drawing.id)).toBe(true);
    });

    it("never leaks another company's drawing through the detail/update/delete routes", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "route-isolation.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x"), metadata: {} });

      currentActorMock.mockResolvedValue(ownerActorB);
      const detailResponse = await drawingDetailGET(new Request("http://localhost/api/drawings/x"), { params: Promise.resolve({ fileId: uploaded.drawing.id }) });
      expect(detailResponse.status).toBe(404);

      const deleteResponse = await drawingDELETE(new Request("http://localhost/api/drawings/x"), { params: Promise.resolve({ fileId: uploaded.drawing.id }) });
      expect(deleteResponse.status).toBe(404);
    });
  });

  // Regression coverage for the production failure: the browser's project URL
  // segment is the project's slug (e.g. "project-00"), never the database
  // UUID. ProjectFile.projectId is a native Postgres `uuid` column, so a slug
  // reaching a repository call unresolved throws "invalid input syntax for
  // type uuid" — a 500, not a clean NotFoundError. These tests exercise the
  // real route handlers with the slug, exactly like production traffic.
  describe("slug-based production routes", () => {
    it("lists drawings through the real GET route using the project slug and returns 200 with a truthful empty array for a project with none", async () => {
      // Created directly via Prisma (not the project-creation service) so this
      // doesn't consume the trial plan's one-draft-project entitlement limit —
      // the point of this fixture is an empty project, not a billable one.
      const client = await createClient(companyAId, { name: "Slug Client", email: `slug-client-${RUN_ID}@example.com` });
      const industryEngine = await prisma.industryEngine.findFirstOrThrow({ where: { key: "construction" }, select: { id: true } });
      const emptyProject = await prisma.project.create({
        data: {
          companyId: companyAId,
          clientId: client.id,
          industryEngineId: industryEngine.id,
          slug: `empty-slug-${RUN_ID}`,
          reference: `DRAW-EMPTY-${RUN_ID}`,
          name: "Empty Slug Project",
        },
      });

      currentActorMock.mockResolvedValue(ownerActorA);
      const response = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: emptyProject.slug }) });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: unknown[] };
      expect(body.ok).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("uploads through the real POST route using the slug, and persists the canonical database UUID (not the slug) in ProjectFile.projectId and the storage key", async () => {
      currentActorMock.mockResolvedValue(ownerActorA);

      const formData = new FormData();
      formData.set("file", new File([pdfBuffer("slug upload content")], "slug-upload.pdf", { type: "application/pdf" }));

      const uploadResponse = await drawingsPOST(
        new Request("http://localhost/api/projects/x/drawings", { method: "POST", body: formData }),
        { params: Promise.resolve({ projectId: projectASlug }) },
      );
      expect(uploadResponse.status).toBe(201);
      const uploadBody = (await uploadResponse.json()) as { ok: boolean; data: { drawing: { id: string } } };
      expect(uploadBody.ok).toBe(true);

      const row = await prisma.projectFile.findUniqueOrThrow({ where: { id: uploadBody.data.drawing.id } });
      expect(row.projectId).toBe(projectAId);
      expect(row.storageKey).toContain(`/projects/${projectAId}/`);
      expect(row.storageKey).not.toContain(`/projects/${projectASlug}/`);
    });

    it("lists a drawing uploaded via the UUID back through a slug-based GET request — both identifiers resolve to the same project", async () => {
      currentActorMock.mockResolvedValue(ownerActorA);
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "uuid-then-slug.pdf", mimeType: "application/pdf", buffer: pdfBuffer("uuid then slug"), metadata: {} });

      const response = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: projectASlug }) });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Array<{ id: string }> };
      expect(body.data.some((d) => d.id === uploaded.drawing.id)).toBe(true);
    });

    it("returns 404 (not 500) when a slug is used for a project belonging to a different tenant", async () => {
      currentActorMock.mockResolvedValue(ownerActorB);
      const response = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: projectASlug }) });
      expect(response.status).toBe(404);
    });

    it("still accepts the database UUID directly (both identifier forms remain supported)", async () => {
      currentActorMock.mockResolvedValue(ownerActorA);
      const response = await drawingsListGET(new Request("http://localhost/api/projects/x/drawings"), { params: Promise.resolve({ projectId: projectAId }) });
      expect(response.status).toBe(200);
    });
  });
});
