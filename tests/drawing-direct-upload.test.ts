import { UserRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  AuthorizedDownload,
  ByteRange,
  DocumentStorageAdapter,
  ObjectMetadata,
  ObjectStreamResult,
  PutObjectInput,
  PutObjectResult,
} from "../src/lib/storage/document-storage-adapter";

/**
 * In-memory fake standing in for Vercel Blob, so authorizeDrawingUpload /
 * finalizeDrawingUpload can be exercised without a real BLOB_READ_WRITE_TOKEN.
 * Every test controls exactly what's "in storage" at finalize time —
 * including scenarios impossible to trigger against real Blob on demand
 * (size mismatch, missing object, corrupted signature).
 */
class FakeBlobAdapter implements DocumentStorageAdapter {
  private objects = new Map<string, { body: Buffer; contentType: string }>();

  seed(key: string, body: Buffer, contentType = "application/pdf") {
    this.objects.set(key, { body, contentType });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType });
    return { key: input.key, size: input.body.byteLength };
  }

  async getObject(key: string): Promise<Buffer> {
    const entry = this.objects.get(key);
    if (!entry) throw new Error(`not found: ${key}`);
    return entry.body;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async objectExists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async getMetadata(key: string): Promise<ObjectMetadata | null> {
    const entry = this.objects.get(key);
    if (!entry) return null;
    return { key, size: entry.body.byteLength, contentType: entry.contentType, lastModified: new Date() };
  }

  async createAuthorizedDownload(_key: string): Promise<AuthorizedDownload> {
    return { mode: "stream" };
  }

  async getObjectStream(key: string, range?: ByteRange): Promise<ObjectStreamResult> {
    const entry = this.objects.get(key);
    if (!entry) throw new Error(`not found: ${key}`);
    const slice = range ? entry.body.subarray(range.start, Math.min(range.end, entry.body.byteLength - 1) + 1) : entry.body;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(slice));
        controller.close();
      },
    });
    return {
      body,
      totalSize: entry.body.byteLength,
      contentType: entry.contentType,
      servedRange: range ? { start: range.start, end: Math.min(range.end, entry.body.byteLength - 1) } : undefined,
    };
  }
}

const fakeAdapter = new FakeBlobAdapter();

vi.mock("@/lib/storage/storage-factory", () => ({
  resolveStorageProvider: () => "vercel-blob",
  createStorageAdapter: () => fakeAdapter,
}));

vi.mock("@/lib/storage/blob-client-upload", () => ({
  generateDrawingUploadToken: vi.fn(async () => "fake-client-token"),
}));

import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { authorizeDrawingUpload, finalizeDrawingUpload } from "../src/lib/services/drawing-service";
import { NotFoundError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = `${Date.now()}-${process.pid}`;

function pdfBuffer(content: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
}

describe("Direct-to-Blob drawing upload (integration, real local Postgres, fake Blob)", () => {
  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
  let projectASlug: string;
  let ownerActorA: CurrentActor;
  let ownerActorB: CurrentActor;

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const companyA = await prisma.company.create({ data: { legalName: `Direct Upload Co A ${RUN_ID}`, tradeName: "Direct A", email: `direct-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    const clientA = await createClient(companyAId, { name: "Direct Client A", email: `direct-client-a-${RUN_ID}@example.com` });
    const ownerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `direct-owner-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorA = { userId: ownerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner A", email: ownerUserA.email };

    const { project } = await createProjectWithDefaultBoq(ownerActorA, {
      clientId: clientA.id,
      industryEngineId: "construction",
      reference: `DIRECT-A-${RUN_ID}`,
      name: "Direct Upload Test Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectAId = project.databaseId;
    projectASlug = project.id;

    const companyB = await prisma.company.create({ data: { legalName: `Direct Upload Co B ${RUN_ID}`, tradeName: "Direct B", email: `direct-b-${RUN_ID}@example.com` } });
    companyBId = companyB.id;
    const ownerUserB = await prisma.user.create({
      data: { companyId: companyBId, email: `direct-owner-b-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorB = { userId: ownerUserB.id, companyId: companyBId, role: UserRole.COMPANY_OWNER, fullName: "Owner B", email: ownerUserB.email };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.projectFile.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.projectFileUploadSession.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: companyAId } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  describe("authorization", () => {
    it("generates a server-controlled tenant-scoped pathname, ignoring any browser-supplied path", async () => {
      const result = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "site-plan.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 1024,
      });
      expect(result.pathname).toContain(`companies/${companyAId}/projects/${projectAId}/drawings/`);
      expect(result.sessionId).toBeTruthy();
      expect(result.uploadToken).toBe("fake-client-token");
      expect(result.maxSizeBytes).toBe(250 * 1024 * 1024);
    });

    it("rejects a declared size above the configured maximum", async () => {
      await expect(
        authorizeDrawingUpload(ownerActorA, projectAId, {
          originalName: "huge.pdf",
          declaredMimeType: "application/pdf",
          declaredByteSize: 250 * 1024 * 1024 + 1,
        }),
      ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    });

    it("accepts exactly 250MB", async () => {
      const result = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "at-limit.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 250 * 1024 * 1024,
      });
      expect(result.sessionId).toBeTruthy();
    });

    it("rejects an unsafe/unsupported extension", async () => {
      await expect(
        authorizeDrawingUpload(ownerActorA, projectAId, {
          originalName: "malware.exe",
          declaredMimeType: "application/octet-stream",
          declaredByteSize: 1024,
        }),
      ).rejects.toMatchObject({ code: "FILE_TYPE_NOT_SUPPORTED" });
    });

    it("accepts PDF declared as application/octet-stream (real-world browser MIME quirk)", async () => {
      const result = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "scan.pdf",
        declaredMimeType: "application/octet-stream",
        declaredByteSize: 2048,
      });
      expect(result.sessionId).toBeTruthy();
    });

    it("authorizes a PDF above the 4.5MB serverless function body-size ceiling — proving these uploads go direct-to-Blob and never depend on a buffered route that would 413", async () => {
      const aboveFunctionBodyLimit = Math.ceil(4.5 * 1024 * 1024) + 1;
      const result = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "above-4-5mb.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: aboveFunctionBodyLimit,
      });
      expect(result.sessionId).toBeTruthy();
      expect(result.pathname).toContain(`companies/${companyAId}/projects/${projectAId}/drawings/`);
    });

    it("scopes the session to the authenticated actor's own company/project — a cross-tenant project id is rejected", async () => {
      await expect(
        authorizeDrawingUpload(ownerActorB, projectAId, {
          originalName: "cross-tenant.pdf",
          declaredMimeType: "application/pdf",
          declaredByteSize: 1024,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("finalization", () => {
    it("succeeds and creates a ProjectFile when the object matches what was declared, and is idempotent on retry", async () => {
      const body = pdfBuffer("real drawing content");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "finalize-success.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");

      const first = await finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} });
      expect(first.alreadyFinalized).toBe(false);
      expect(first.drawing.fileSize).toBe(body.byteLength);
      expect(first.drawing.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(first.drawing.pageCount).toBeNull();

      const countAfterFirst = await prisma.projectFile.count({ where: { id: first.drawing.id } });
      expect(countAfterFirst).toBe(1);

      // Duplicate finalize call (e.g. a retried network request) — idempotent, no duplicate row, no error.
      const second = await finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} });
      expect(second.alreadyFinalized).toBe(true);
      expect(second.drawing.id).toBe(first.drawing.id);
      const countAfterSecond = await prisma.projectFile.count({ where: { id: first.drawing.id } });
      expect(countAfterSecond).toBe(1);
    });

    it("rejects finalize when the actual stored size does not match the declared size", async () => {
      const declaredSize = 5000;
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "size-mismatch.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: declaredSize,
      });
      fakeAdapter.seed(auth.pathname, pdfBuffer("much smaller than declared"), "application/pdf");

      await expect(finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} })).rejects.toMatchObject({
        code: "UPLOAD_SIZE_MISMATCH",
      });
    });

    it("rejects finalize when the Blob object never actually arrived", async () => {
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "missing-object.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 1024,
      });
      // Deliberately never seed the fake adapter — simulates the PUT never completing.
      await expect(finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} })).rejects.toMatchObject({
        code: "BLOB_OBJECT_MISSING",
      });
    });

    it("rejects a file whose bytes do not have a real PDF signature, even though the extension and declared size are correct", async () => {
      const fakeBody = Buffer.from("this is not a pdf, just renamed");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "renamed.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: fakeBody.byteLength,
      });
      fakeAdapter.seed(auth.pathname, fakeBody, "application/pdf");

      await expect(finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} })).rejects.toMatchObject({
        code: "UNSAFE_FILE_CONTENT",
      });
      expect(await fakeAdapter.objectExists(auth.pathname)).toBe(false);
    });

    it("rejects finalize for a session belonging to a different company", async () => {
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "tenant-a-only.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 100,
      });
      fakeAdapter.seed(auth.pathname, pdfBuffer("x"), "application/pdf");

      await expect(finalizeDrawingUpload(ownerActorB, projectAId, { sessionId: auth.sessionId, metadata: {} })).rejects.toThrow(NotFoundError);
    });

    it("rejects finalize with a nonexistent sessionId", async () => {
      await expect(
        finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: "00000000-0000-0000-0000-000000000000", metadata: {} }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects finalize for an expired session", async () => {
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "expired.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 100,
      });
      await prisma.projectFileUploadSession.update({ where: { id: auth.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      fakeAdapter.seed(auth.pathname, pdfBuffer("x"), "application/pdf");

      await expect(finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} })).rejects.toMatchObject({
        code: "UPLOAD_SESSION_EXPIRED",
      });
      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
      expect(session.status).toBe("EXPIRED");
    });

    it("records an audit event on successful finalize", async () => {
      const body = pdfBuffer("audited content");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "audited.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");
      const result = await finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} });

      const auditEntry = await prisma.auditLog.findFirst({
        where: { companyId: companyAId, entityType: "ProjectFile", entityId: result.drawing.id, action: "DRAWING_UPLOADED" },
      });
      expect(auditEntry).not.toBeNull();
    });
  });

  // Same production regression as tests/drawing-upload.test.ts: the browser
  // always sends the project slug, not the UUID. authorizeDrawingUpload and
  // finalizeDrawingUpload must resolve it once and use the canonical UUID
  // for storage keys, the upload session's projectId column, and the
  // finalized ProjectFile row — not the slug string itself.
  describe("slug-based direct-upload workflow", () => {
    it("authorizes using the slug and still builds a storage pathname keyed by the canonical database UUID", async () => {
      const result = await authorizeDrawingUpload(ownerActorA, projectASlug, {
        originalName: "slug-authorized.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 1024,
      });
      expect(result.pathname).toContain(`companies/${companyAId}/projects/${projectAId}/drawings/`);
      expect(result.pathname).not.toContain(`/projects/${projectASlug}/`);

      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: result.sessionId } });
      expect(session.projectId).toBe(projectAId);
    });

    it("finalizes an authorize-by-slug session using the slug again, and persists the canonical UUID on the ProjectFile row", async () => {
      const body = pdfBuffer("slug finalize content");
      const auth = await authorizeDrawingUpload(ownerActorA, projectASlug, {
        originalName: "slug-finalize.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");

      const result = await finalizeDrawingUpload(ownerActorA, projectASlug, { sessionId: auth.sessionId, metadata: {} });
      expect(result.alreadyFinalized).toBe(false);

      const row = await prisma.projectFile.findUniqueOrThrow({ where: { id: result.drawing.id } });
      expect(row.projectId).toBe(projectAId);
    });

    it("rejects a cross-tenant slug at authorization with the same NotFoundError as an unknown project (no existence leak)", async () => {
      await expect(
        authorizeDrawingUpload(ownerActorB, projectASlug, {
          originalName: "cross-tenant-slug.pdf",
          declaredMimeType: "application/pdf",
          declaredByteSize: 1024,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
