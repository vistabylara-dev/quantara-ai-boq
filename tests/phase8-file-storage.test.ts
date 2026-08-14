import { ExtractionEngineType, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { findOrCreateQueuedExtractionJob } from "../src/lib/repositories/extraction-job-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import {
  archiveProjectFile,
  getProjectFile,
  getProjectFileForStreamingDownload,
  listProjectFilesForProject,
  uploadProjectFile,
} from "../src/lib/services/project-file-service";

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
import { buildStorageKey, computeChecksum, MAX_FILE_SIZE_BYTES, validateUpload } from "../src/lib/files/file-security";
import { StorageKeyError } from "../src/lib/storage/document-storage-adapter";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";
import { AppError, NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

describe("Phase 8 sub-phase 1: file security and storage (integration, real local Postgres)", () => {
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
      data: { legalName: `Phase8 Test Co A ${RUN_ID}`, tradeName: `Phase8 A`, email: `phase8-a-${RUN_ID}@example.com` },
    });
    companyAId = companyA.id;
    cleanupCompanyIds.push(companyAId);
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    const clientA = await createClient(companyAId, { name: "Client A", email: `phase8-client-a-${RUN_ID}@example.com` });

    const ownerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `phase8-owner-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    const designerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `phase8-designer-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Designer A", role: UserRole.DESIGNER, isActive: true, emailVerifiedAt: new Date() },
    });
    const reviewerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `phase8-reviewer-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Reviewer A", role: UserRole.REVIEWER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorA = { userId: ownerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner A", email: ownerUserA.email };
    designerActorA = { userId: designerUserA.id, companyId: companyAId, role: UserRole.DESIGNER, fullName: "Designer A", email: designerUserA.email };
    reviewerActorA = { userId: reviewerUserA.id, companyId: companyAId, role: UserRole.REVIEWER, fullName: "Reviewer A", email: reviewerUserA.email };

    const { project } = await createProjectWithDefaultBoq(ownerActorA, {
      clientId: clientA.id,
      industryEngineId: "construction",
      reference: `P8-A-${RUN_ID}`,
      name: "Phase8 Project A",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;
    projectASlug = project.id;

    const companyB = await prisma.company.create({
      data: { legalName: `Phase8 Test Co B ${RUN_ID}`, tradeName: `Phase8 B`, email: `phase8-b-${RUN_ID}@example.com` },
    });
    companyBId = companyB.id;
    cleanupCompanyIds.push(companyBId);
    await prisma.companyIndustryEngine.create({ data: { companyId: companyBId, industryEngineId: construction.id, enabled: true } });
    const ownerUserB = await prisma.user.create({
      data: { companyId: companyBId, email: `phase8-owner-b-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorB = { userId: ownerUserB.id, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Owner B", email: ownerUserB.email };
  });

  afterAll(async () => {
    for (const companyId of cleanupCompanyIds) {
      await prisma.projectFileArchive.deleteMany({ where: { companyId } });
      await prisma.extractionJob.deleteMany({ where: { companyId } });
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

  describe("file-security validation (unit)", () => {
    it("accepts a supported extension/MIME/size combination", () => {
      const result = validateUpload("Floor Plan.pdf", "application/pdf", 1024);
      expect(result.extension).toBe("pdf");
      expect(result.safeFileName).toMatch(/^floor-plan-[0-9a-f-]{36}\.pdf$/);
    });

    it("rejects an unsupported extension", () => {
      expect(() => validateUpload("virus.exe", "application/octet-stream", 1024)).toThrow(AppError);
      try {
        validateUpload("virus.exe", "application/octet-stream", 1024);
      } catch (error) {
        expect((error as AppError).code).toBe("FILE_TYPE_NOT_SUPPORTED");
      }
    });

    it("rejects a MIME type that does not match the extension", () => {
      try {
        validateUpload("plan.pdf", "image/png", 1024);
        expect.unreachable();
      } catch (error) {
        expect((error as AppError).code).toBe("FILE_MIME_MISMATCH");
      }
    });

    it("rejects an empty file", () => {
      try {
        validateUpload("plan.pdf", "application/pdf", 0);
        expect.unreachable();
      } catch (error) {
        expect((error as AppError).code).toBe("FILE_EMPTY");
      }
    });

    it("rejects a file larger than the size limit", () => {
      try {
        validateUpload("plan.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1);
        expect.unreachable();
      } catch (error) {
        expect((error as AppError).code).toBe("FILE_TOO_LARGE");
      }
    });

    it("trusts DXF/DWG/IFC extensions regardless of the (unreliable) browser-supplied MIME type", () => {
      expect(() => validateUpload("layout.dxf", "application/octet-stream", 1024)).not.toThrow();
      expect(() => validateUpload("model.dwg", "application/octet-stream", 1024)).not.toThrow();
      expect(() => validateUpload("building.ifc", "application/octet-stream", 1024)).not.toThrow();
    });

    it("computes a deterministic sha256 checksum", () => {
      const a = computeChecksum(Buffer.from("hello"));
      const b = computeChecksum(Buffer.from("hello"));
      const c = computeChecksum(Buffer.from("world"));
      expect(a).toBe(b);
      expect(a).not.toBe(c);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it("builds a tenant- and project-scoped storage key", () => {
      const key = buildStorageKey("company-1", "project-1", "originals", "file.pdf");
      expect(key).toBe("companies/company-1/projects/project-1/originals/file.pdf");
    });
  });

  describe("storage adapter path-traversal safety", () => {
    it("rejects a key that attempts to escape the storage root", async () => {
      await expect(localProjectFileStorageAdapter.getObject("../../etc/passwd")).rejects.toThrow(StorageKeyError);
      await expect(localProjectFileStorageAdapter.getObject("/etc/passwd")).rejects.toThrow(StorageKeyError);
    });
  });

  describe("upload, list, download, delete (service + RBAC + tenant isolation)", () => {
    describe("slug and UUID project identifiers", () => {
      it("uploads by slug while persisting the canonical project UUID in the row and storage key", async () => {
        const result = await uploadProjectFile(ownerActorA, projectASlug, {
          originalName: "slug-upload.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer("slug upload content"),
        });

        const row = await prisma.projectFile.findUniqueOrThrow({ where: { id: result.file.id } });
        expect(row.projectId).toBe(projectAId);
        expect(row.storageKey).toContain(`/projects/${projectAId}/`);
        expect(row.storageKey).not.toContain(`/projects/${projectASlug}/`);
      });

      it("lists through the slug a file uploaded through the database UUID", async () => {
        const uploaded = await uploadProjectFile(ownerActorA, projectAId, {
          originalName: "uuid-then-slug.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer("uuid then slug content"),
        });

        const files = await listProjectFilesForProject(reviewerActorA, projectASlug);
        expect(files.some((file) => file.id === uploaded.file.id)).toBe(true);
      });

      it("detects duplicates across UUID and slug forms of the same project", async () => {
        const bytes = pdfBuffer("cross-identifier duplicate content");
        const first = await uploadProjectFile(ownerActorA, projectAId, {
          originalName: "duplicate-by-uuid.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        });
        const second = await uploadProjectFile(ownerActorA, projectASlug, {
          originalName: "duplicate-by-slug.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        });

        expect(second.duplicateOfFileId).toBe(first.file.id);
      });

      it("denies a cross-tenant slug for both upload and list without creating a file", async () => {
        const beforeCount = await prisma.projectFile.count({ where: { companyId: companyBId } });

        await expect(listProjectFilesForProject(ownerActorB, projectASlug)).rejects.toThrow(NotFoundError);
        await expect(
          uploadProjectFile(ownerActorB, projectASlug, {
            originalName: "cross-tenant-slug.pdf",
            mimeType: "application/pdf",
            buffer: pdfBuffer("must not persist"),
          }),
        ).rejects.toThrow(NotFoundError);

        expect(await prisma.projectFile.count({ where: { companyId: companyBId } })).toBe(beforeCount);
      });

      it("continues to accept the database UUID directly for upload and list", async () => {
        const uploaded = await uploadProjectFile(ownerActorA, projectAId, {
          originalName: "direct-uuid.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer("direct uuid content"),
        });

        expect(uploaded.file.projectId).toBe(projectAId);
        const files = await listProjectFilesForProject(reviewerActorA, projectAId);
        expect(files.some((file) => file.id === uploaded.file.id)).toBe(true);
      });
    });

    it("uploads a file and returns UPLOADED status with UNKNOWN classification", async () => {
      const result = await uploadProjectFile(ownerActorA, projectAId, {
        originalName: "structural-schedule.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer("structural schedule content"),
      });
      expect(result.file.status).toBe("UPLOADED");
      expect(result.file.classification).toBe("UNKNOWN");
      expect(result.file.originalName).toBe("structural-schedule.pdf");
      expect(result.duplicateOfFileId).toBeNull();
      expect(result.file.checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    it("detects a duplicate upload by checksum without blocking it", async () => {
      const bytes = pdfBuffer("identical content for duplicate test");
      const first = await uploadProjectFile(ownerActorA, projectAId, { originalName: "rev-a.pdf", mimeType: "application/pdf", buffer: bytes });
      const second = await uploadProjectFile(ownerActorA, projectAId, { originalName: "rev-b.pdf", mimeType: "application/pdf", buffer: bytes });
      expect(second.duplicateOfFileId).toBe(first.file.id);
    });

    it("rejects upload from a role without the files:manage capability", async () => {
      await expect(
        uploadProjectFile(reviewerActorA, projectAId, { originalName: "plan.pdf", mimeType: "application/pdf", buffer: pdfBuffer("x") }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("allows upload from a role that does hold files:manage (DESIGNER)", async () => {
      const result = await uploadProjectFile(designerActorA, projectAId, { originalName: "designer-upload.pdf", mimeType: "application/pdf", buffer: pdfBuffer("designer content") });
      expect(result.file.status).toBe("UPLOADED");
    });

    it("allows read (list/detail/download) from a role without files:manage — read is not capability-gated", async () => {
      const uploaded = await uploadProjectFile(ownerActorA, projectAId, { originalName: "readable.pdf", mimeType: "application/pdf", buffer: pdfBuffer("readable content") });
      const list = await listProjectFilesForProject(reviewerActorA, projectAId);
      expect(list.some((f) => f.id === uploaded.file.id)).toBe(true);
      const detail = await getProjectFile(reviewerActorA, uploaded.file.id);
      expect(detail.id).toBe(uploaded.file.id);
      const download = await getProjectFileForStreamingDownload(reviewerActorA, uploaded.file.id);
      const body = await readStreamToBuffer(download.body);
      expect(body.toString()).toBe(pdfBuffer("readable content").toString());
      expect(download.fileName).toBe("readable.pdf");
    });

    it("enforces tenant isolation on read, download, and archive", async () => {
      const uploaded = await uploadProjectFile(ownerActorA, projectAId, { originalName: "tenant-isolation.pdf", mimeType: "application/pdf", buffer: pdfBuffer("tenant isolation content") });

      await expect(getProjectFile(ownerActorB, uploaded.file.id)).rejects.toThrow(NotFoundError);
      await expect(getProjectFileForStreamingDownload(ownerActorB, uploaded.file.id)).rejects.toThrow(NotFoundError);
      await expect(archiveProjectFile(ownerActorB, uploaded.file.id)).rejects.toThrow(NotFoundError);
    });

    it("archives a file while retaining its row, bytes, download, and audit evidence", async () => {
      const sourceBytes = pdfBuffer("retain me");
      const uploaded = await uploadProjectFile(ownerActorA, projectAId, { originalName: "to-archive.pdf", mimeType: "application/pdf", buffer: sourceBytes });
      const stored = await prisma.projectFile.findUniqueOrThrow({ where: { id: uploaded.file.id } });

      const archived = await archiveProjectFile(ownerActorA, uploaded.file.id);

      expect(archived).toMatchObject({ id: uploaded.file.id, status: "ARCHIVED", isArchived: true });
      expect(archived.archivedAt).not.toBeNull();
      expect((await getProjectFile(ownerActorA, uploaded.file.id)).isArchived).toBe(true);
      expect((await listProjectFilesForProject(ownerActorA, projectAId)).some((file) => file.id === uploaded.file.id)).toBe(false);
      const download = await getProjectFileForStreamingDownload(ownerActorA, uploaded.file.id);
      expect((await readStreamToBuffer(download.body)).equals(sourceBytes)).toBe(true);
      expect(await localProjectFileStorageAdapter.objectExists(stored.storageKey)).toBe(true);
      expect(await prisma.projectFileArchive.findUnique({ where: { projectFileId: uploaded.file.id } })).toMatchObject({
        companyId: companyAId,
        archivedByUserId: ownerActorA.userId,
      });
      await expect(findOrCreateQueuedExtractionJob({
        companyId: companyAId,
        projectId: projectAId,
        projectFileId: uploaded.file.id,
        engineType: ExtractionEngineType.TABLE_EXTRACTION,
        createdByUserId: ownerActorA.userId,
      })).rejects.toMatchObject({ code: "FILE_ARCHIVED" });
      await expect(prisma.extractionJob.create({
        data: {
          companyId: companyAId,
          projectId: projectAId,
          projectFileId: uploaded.file.id,
          engineType: ExtractionEngineType.TABLE_EXTRACTION,
          createdByUserId: ownerActorA.userId,
        },
      })).rejects.toThrow();
      await expect(prisma.projectFile.delete({ where: { id: uploaded.file.id } })).rejects.toThrow();
      expect(await prisma.auditLog.count({ where: { companyId: companyAId, entityId: uploaded.file.id, action: "FILE_ARCHIVED" } })).toBe(1);
    });

    it("rejects archive from a role without the files:manage capability", async () => {
      const uploaded = await uploadProjectFile(ownerActorA, projectAId, { originalName: "protected.pdf", mimeType: "application/pdf", buffer: pdfBuffer("protected content") });
      await expect(archiveProjectFile(reviewerActorA, uploaded.file.id)).rejects.toThrow(PermissionDeniedError);
    });
  });
});
