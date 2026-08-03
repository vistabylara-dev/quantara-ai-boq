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
  deleteProjectDrawing,
  getProjectDrawing,
  listProjectDrawings,
  updateProjectDrawingMetadata,
  uploadProjectDrawing,
} from "../src/lib/services/drawing-service";
import { getProjectFileForDownload } from "../src/lib/services/project-file-service";
import { DRAWING_MAX_FILE_SIZE_BYTES } from "../src/lib/validation/drawing-schema";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";
import { AppError, NotFoundError, PermissionDeniedError, UnauthorizedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

describe("Drawing upload & intake pipeline (integration, real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
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

    it("rejects a file over the 25MB drawing-specific limit", async () => {
      await expect(
        uploadProjectDrawing(ownerActorA, projectAId, {
          originalName: "huge.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.alloc(DRAWING_MAX_FILE_SIZE_BYTES + 1),
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
      const download = await getProjectFileForDownload(ownerActorA, result.drawing.id);
      expect(download.buffer.toString()).toBe(pdfBuffer("traversal attempt").toString());
    });

    it("gives two drawings with the identical original filename distinct, non-colliding storage keys", async () => {
      const bufferA = pdfBuffer("first same-name file");
      const bufferB = pdfBuffer("second same-name file");
      const first = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "same-name.pdf", mimeType: "application/pdf", buffer: bufferA, metadata: {} });
      const second = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "same-name.pdf", mimeType: "application/pdf", buffer: bufferB, metadata: {} });
      expect(first.drawing.id).not.toBe(second.drawing.id);

      const downloadA = await getProjectFileForDownload(ownerActorA, first.drawing.id);
      const downloadB = await getProjectFileForDownload(ownerActorA, second.drawing.id);
      expect(downloadA.buffer.toString()).toBe(bufferA.toString());
      expect(downloadB.buffer.toString()).toBe(bufferB.toString());
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

    it("enforces tenant isolation on read, download, update, and delete", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "tenant-isolation.pdf", mimeType: "application/pdf", buffer: pdfBuffer("tenant isolation content"), metadata: {} });

      await expect(getProjectDrawing(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
      await expect(getProjectFileForDownload(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
      await expect(updateProjectDrawingMetadata(ownerActorB, uploaded.drawing.id, { discipline: "CIVIL" })).rejects.toThrow(NotFoundError);
      await expect(deleteProjectDrawing(ownerActorB, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
    });

    it("denies a guessed/nonexistent drawing ID with the same NotFoundError as a real cross-tenant ID (no existence leak)", async () => {
      await expect(getProjectDrawing(ownerActorA, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundError);
    });

    it("rejects delete from a role without the files:manage capability", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "protected.pdf", mimeType: "application/pdf", buffer: pdfBuffer("protected content"), metadata: {} });
      await expect(deleteProjectDrawing(reviewerActorA, uploaded.drawing.id)).rejects.toThrow(PermissionDeniedError);
    });

    it("deletes a drawing and makes it unreachable afterward", async () => {
      const uploaded = await uploadProjectDrawing(ownerActorA, projectAId, { originalName: "to-delete.pdf", mimeType: "application/pdf", buffer: pdfBuffer("delete me"), metadata: {} });
      await deleteProjectDrawing(ownerActorA, uploaded.drawing.id);
      await expect(getProjectDrawing(ownerActorA, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
      await expect(getProjectFileForDownload(ownerActorA, uploaded.drawing.id)).rejects.toThrow(NotFoundError);
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
});
