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
const generateDrawingUploadTokenMock = vi.hoisted(() => vi.fn(async () => "fake-client-token"));
const setUploadSessionStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/storage-factory", () => ({
  resolveStorageProvider: () => "vercel-blob",
  createStorageAdapter: () => fakeAdapter,
}));

vi.mock("@/lib/storage/blob-client-upload", () => ({
  generateDrawingUploadToken: generateDrawingUploadTokenMock,
}));

vi.mock("@/lib/repositories/project-file-upload-session-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/repositories/project-file-upload-session-repository")>();
  setUploadSessionStatusMock.mockImplementation(actual.setUploadSessionStatus);
  return { ...actual, setUploadSessionStatus: setUploadSessionStatusMock };
});

import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { authorizeDrawingUpload, finalizeDrawingUpload } from "../src/lib/services/drawing-service";
import { createProjectFile } from "../src/lib/repositories/project-file-repository";
import { computeChecksum } from "../src/lib/files/file-security";
import {
  uploadDrawingWithSafeRouting,
  type DrawingUploadDependencies,
} from "../src/lib/drawings/upload-routing";
import { NotFoundError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

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
  let managerActorA: CurrentActor;
  let ownerActorB: CurrentActor;

  beforeAll(async () => {
    requireIsolatedLocalTestDatabase();
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const companyA = await prisma.company.create({ data: { legalName: `Direct Upload Co A ${RUN_ID}`, tradeName: "Direct A", email: `direct-a-${RUN_ID}@example.com` } });
    companyAId = companyA.id;
    await prisma.companyIndustryEngine.create({ data: { companyId: companyAId, industryEngineId: construction.id, enabled: true } });
    const clientA = await createClient(companyAId, { name: "Direct Client A", email: `direct-client-a-${RUN_ID}@example.com` });
    const ownerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `direct-owner-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    ownerActorA = { userId: ownerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Owner A", email: ownerUserA.email };
    const managerUserA = await prisma.user.create({
      data: { companyId: companyAId, email: `direct-manager-a-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Manager A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    managerActorA = { userId: managerUserA.id, companyId: companyAId, role: UserRole.COMPANY_OWNER, fullName: "Manager A", email: managerUserA.email };

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
      expect(result.contentType).toBe("application/pdf");
      expect(result.maxSizeBytes).toBe(250 * 1024 * 1024);
      expect(generateDrawingUploadTokenMock).toHaveBeenLastCalledWith(expect.objectContaining({
        pathname: result.pathname,
        contentType: "application/pdf",
        maxSizeBytes: 1024,
      }));
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
      expect(result.contentType).toBe("application/pdf");
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
      expect(result.contentType).toBe("application/pdf");
    });

    it("does not leave a PENDING session or authorization audit when scoped Blob token generation fails", async () => {
      const sessionCountBefore = await prisma.projectFileUploadSession.count({
        where: { companyId: companyAId, projectId: projectAId },
      });
      const auditCountBefore = await prisma.auditLog.count({
        where: { companyId: companyAId, action: "DRAWING_UPLOAD_AUTHORIZED" },
      });
      generateDrawingUploadTokenMock.mockRejectedValueOnce(new Error("injected token generation failure"));

      await expect(authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "token-failure.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: 1024,
      })).rejects.toThrow("injected token generation failure");

      expect(await prisma.projectFileUploadSession.count({
        where: { companyId: companyAId, projectId: projectAId },
      })).toBe(sessionCountBefore);
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, action: "DRAWING_UPLOAD_AUTHORIZED" },
      })).toBe(auditCountBefore);
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

  describe("browser-to-service production workflow", () => {
    it("moves an actual PDF above 4.5 MiB through authorize -> private Blob -> finalize without invoking the buffered app route", async () => {
      const byteSize = Math.ceil(4.5 * 1024 * 1024) + 1;
      const bytes = new Uint8Array(byteSize);
      bytes.set(new TextEncoder().encode("%PDF-1.4\n"), 0);
      bytes.set(new TextEncoder().encode("\n%%EOF"), byteSize - 6);
      const file = new File([bytes], "browser-above-function-limit.pdf", { type: "application/pdf" });
      const order: string[] = [];
      const bufferedUpload = vi.fn<DrawingUploadDependencies["bufferedUpload"]>();
      let finalizedDrawingId: string | undefined;

      const result = await uploadDrawingWithSafeRouting(
        {
          file,
          metadata: { discipline: "ARCHITECTURAL" },
          isProduction: true,
          onStage: () => undefined,
          onProgress: () => undefined,
        },
        {
          authorize: async (declaration) => {
            order.push("authorize");
            return authorizeDrawingUpload(ownerActorA, projectAId, declaration);
          },
          transferToPrivateBlob: async (transfer) => {
            order.push("transfer");
            expect(transfer.access).toBe("private");
            expect(transfer.file).toBe(file);
            fakeAdapter.seed(
              transfer.pathname,
              Buffer.from(await transfer.file.arrayBuffer()),
              transfer.contentType,
            );
          },
          finalize: async (input) => {
            order.push("finalize");
            const finalized = await finalizeDrawingUpload(ownerActorA, projectAId, input);
            finalizedDrawingId = finalized.drawing.id;
          },
          bufferedUpload,
          getErrorMessage: (error) => error instanceof Error ? error.message : "Unknown error",
        },
      );

      expect(file.size).toBeGreaterThan(4.5 * 1024 * 1024);
      expect(result).toBe("direct");
      expect(order).toEqual(["authorize", "transfer", "finalize"]);
      expect(bufferedUpload).not.toHaveBeenCalled();
      expect(finalizedDrawingId).toBeTruthy();
      if (!finalizedDrawingId) throw new Error("Expected the direct upload to finalize a drawing.");

      const stored = await prisma.projectFile.findUniqueOrThrow({ where: { id: finalizedDrawingId } });
      expect(stored.fileSize).toBe(file.size);
      expect(stored.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(await prisma.projectFile.count({ where: { id: finalizedDrawingId } })).toBe(1);
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

    it("self-heals a PENDING session when its exact ProjectFile already exists from the old failure window", async () => {
      const body = pdfBuffer("old partial finalize");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "old-partial-finalize.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");
      const partialFile = await createProjectFile(companyAId, {
        id: session.fileId,
        projectId: projectAId,
        uploadedByUserId: ownerActorA.userId,
        originalName: session.originalName,
        safeFileName: session.storageKey.split("/").pop() ?? session.originalName,
        storageKey: session.storageKey,
        mimeType: session.declaredMimeType,
        extension: session.extension,
        fileSize: body.byteLength,
        checksum: computeChecksum(body),
        metadataJson: { recordKind: "drawing", discipline: "ARCHITECTURAL" },
      });

      expect(session.status).toBe("PENDING");
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, entityId: partialFile.id, action: "DRAWING_UPLOADED" },
      })).toBe(0);

      const healed = await finalizeDrawingUpload(ownerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: { discipline: "ARCHITECTURAL" },
      });

      expect(healed.alreadyFinalized).toBe(true);
      expect(healed.drawing.id).toBe(partialFile.id);
      expect((await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } })).status).toBe("FINALIZED");
      expect(await prisma.projectFile.count({ where: { id: partialFile.id } })).toBe(1);
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, entityId: partialFile.id, action: "DRAWING_UPLOADED" },
      })).toBe(1);
    });

    it("rolls back the file when the FINALIZED transition fails, then succeeds once on retry", async () => {
      const body = pdfBuffer("transaction rollback and retry");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "status-transition-failure.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");
      setUploadSessionStatusMock.mockRejectedValueOnce(new Error("injected FINALIZED transition failure"));

      await expect(finalizeDrawingUpload(ownerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: {},
      })).rejects.toThrow("injected FINALIZED transition failure");

      expect(await prisma.projectFile.count({ where: { id: session.fileId } })).toBe(0);
      expect((await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } })).status).toBe("PENDING");
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, entityId: session.fileId, action: "DRAWING_UPLOADED" },
      })).toBe(0);

      const retried = await finalizeDrawingUpload(ownerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: {},
      });
      expect(retried.alreadyFinalized).toBe(false);
      expect(retried.drawing.id).toBe(session.fileId);
      expect(await prisma.projectFile.count({ where: { id: session.fileId } })).toBe(1);
      expect((await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } })).status).toBe("FINALIZED");
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, entityId: session.fileId, action: "DRAWING_UPLOADED" },
      })).toBe(1);
    });

    it("serializes concurrent finalize requests into one file and one success audit", async () => {
      const body = pdfBuffer("concurrent finalize");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "concurrent-finalize.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
      fakeAdapter.seed(auth.pathname, body, "application/pdf");

      const results = await Promise.all([
        finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} }),
        finalizeDrawingUpload(ownerActorA, projectAId, { sessionId: auth.sessionId, metadata: {} }),
      ]);

      expect(results.map((result) => result.drawing.id)).toEqual([session.fileId, session.fileId]);
      expect(results.map((result) => result.alreadyFinalized).sort()).toEqual([false, true]);
      expect(await prisma.projectFile.count({ where: { id: session.fileId } })).toBe(1);
      expect(await prisma.auditLog.count({
        where: { companyId: companyAId, entityId: session.fileId, action: "DRAWING_UPLOADED" },
      })).toBe(1);
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

    it("rejects Blob metadata whose MIME differs from the server-authorized canonical type", async () => {
      const body = Buffer.from("png-shaped test payload");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "mime-bound.png",
        declaredMimeType: "image/png",
        declaredByteSize: body.byteLength,
      });
      expect(auth.contentType).toBe("image/png");
      fakeAdapter.seed(auth.pathname, body, "application/octet-stream");

      await expect(finalizeDrawingUpload(ownerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: {},
      })).rejects.toMatchObject({ code: "UPLOAD_MIME_MISMATCH" });
      expect(await fakeAdapter.objectExists(auth.pathname)).toBe(false);
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

    it("prevents a different same-tenant user from finalizing or changing uploader attribution", async () => {
      const body = pdfBuffer("authorizing user attribution");
      const auth = await authorizeDrawingUpload(ownerActorA, projectAId, {
        originalName: "actor-bound.pdf",
        declaredMimeType: "application/pdf",
        declaredByteSize: body.byteLength,
      });
      const session = await prisma.projectFileUploadSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
      fakeAdapter.seed(auth.pathname, body, auth.contentType);

      await expect(finalizeDrawingUpload(managerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: { title: "Changed by another user" },
      })).rejects.toThrow(NotFoundError);
      expect(await prisma.projectFile.count({ where: { id: session.fileId } })).toBe(0);

      const finalized = await finalizeDrawingUpload(ownerActorA, projectAId, {
        sessionId: auth.sessionId,
        metadata: { title: "Authorized title" },
      });
      const stored = await prisma.projectFile.findUniqueOrThrow({ where: { id: finalized.drawing.id } });
      expect(stored.uploadedByUserId).toBe(ownerActorA.userId);
      expect(stored.drawingTitle).toBe("Authorized title");
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
