import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const driveMocks = vi.hoisted(() => ({
  getGoogleDriveFileMetadata: vi.fn(),
  downloadGoogleDriveFile: vi.fn(),
  isGoogleDriveFolder: vi.fn((file: { mimeType: string }) => file.mimeType === "application/vnd.google-apps.folder"),
}));

vi.mock("@/lib/integrations/connectors/google-drive-client", () => ({
  buildGoogleDriveAuthorizationUrl: vi.fn(),
  exchangeGoogleDriveAuthorizationCode: vi.fn(),
  refreshGoogleDriveAccessToken: vi.fn(),
  listGoogleDriveFiles: vi.fn(),
  getGoogleDriveFileMetadata: driveMocks.getGoogleDriveFileMetadata,
  downloadGoogleDriveFile: driveMocks.downloadGoogleDriveFile,
  isGoogleDriveFolder: driveMocks.isGoogleDriveFolder,
}));

vi.mock("@/lib/entitlements/integration-entitlement-service", () => ({
  getIntegrationEntitlements: vi.fn().mockResolvedValue({
    manualSync: true,
    allowedProviderFamilies: ["google"],
  }),
}));

import type { CurrentActor } from "../src/lib/auth/current-actor";
import { setActorContext } from "../src/lib/auth/request-context";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import {
  upsertConnectedExternalConnection,
  upsertIntegrationProvider,
} from "../src/lib/repositories/integration-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { importGoogleDriveFile } from "../src/lib/services/google-drive-integration-service";
import {
  listProjectFilesForProject,
  triggerFileClassification,
} from "../src/lib/services/project-file-service";
import { localProjectFileStorageAdapter } from "../src/lib/storage/local-project-file-storage-adapter";

const RUN_ID = Date.now();
const ACCESS_TOKEN = `drive-access-secret-${RUN_ID}`;
const REFRESH_TOKEN = `drive-refresh-secret-${RUN_ID}`;
const FILE_BYTES = Buffer.from("%PDF-1.4\nGoogle Drive import integration\n%%EOF");

describe("Google Drive selected-file import (integration, real local Postgres and private local storage)", () => {
  let actor: CurrentActor;
  let companyId: string;
  let projectId: string;
  let projectSlug: string;
  const storageKeys: string[] = [];
  const originalEncryptionKey = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");

    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: {
        legalName: `Drive Import Test ${RUN_ID}`,
        tradeName: `Drive Import ${RUN_ID}`,
        email: `drive-import-${RUN_ID}@example.com`,
      },
    });
    companyId = company.id;
    await prisma.companyIndustryEngine.create({
      data: { companyId, industryEngineId: construction.id, enabled: true },
    });

    const user = await prisma.user.create({
      data: {
        companyId,
        email: `drive-import-owner-${RUN_ID}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: "Drive Import Owner",
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    actor = {
      userId: user.id,
      companyId,
      role: UserRole.COMPANY_OWNER,
      fullName: user.fullName,
      email: user.email,
    };
    setActorContext(actor);

    const client = await createClient(companyId, {
      name: "Drive Import Client",
      email: `drive-import-client-${RUN_ID}@example.com`,
    });
    const created = await createProjectWithDefaultBoq(actor, {
      clientId: client.id,
      industryEngineId: "construction",
      reference: `DRIVE-${RUN_ID}`,
      name: "Drive Import Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    projectId = created.project.databaseId;
    projectSlug = created.project.id;

    await upsertIntegrationProvider({
      id: "google-drive",
      providerFamily: "google",
      displayName: "Google Drive",
      category: "DOCUMENTS_STORAGE",
      connectionType: "OAUTH_CLOUD",
      status: "BETA",
    });
    await upsertConnectedExternalConnection({
      companyId,
      connectedByUserId: user.id,
      providerId: "google-drive",
      credentials: {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        scope: "https://www.googleapis.com/auth/drive.readonly",
        tokenType: "Bearer",
      },
      providerAccountId: null,
      grantedScopesJson: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    driveMocks.getGoogleDriveFileMetadata.mockResolvedValue({
      id: "drive-file-integration-1",
      name: "dubai-cost-plan.pdf",
      mimeType: "application/pdf",
      size: String(FILE_BYTES.byteLength),
      modifiedTime: "2026-08-08T12:00:00.000Z",
      parents: ["root"],
      iconLink: null,
      webViewLink: "https://drive.google.com/file/d/drive-file-integration-1/view",
    });
    driveMocks.downloadGoogleDriveFile.mockResolvedValue({
      bytes: FILE_BYTES.buffer.slice(FILE_BYTES.byteOffset, FILE_BYTES.byteOffset + FILE_BYTES.byteLength),
      contentType: "application/pdf",
      contentLength: FILE_BYTES.byteLength,
    });
  });

  afterAll(async () => {
    for (const storageKey of storageKeys) {
      await localProjectFileStorageAdapter.deleteObject(storageKey);
    }
    if (companyId) {
      await prisma.extractionJob.deleteMany({ where: { companyId } });
      await prisma.projectFile.deleteMany({ where: { companyId } });
      await prisma.bOQItem.deleteMany({ where: { companyId } });
      await prisma.bOQSection.deleteMany({ where: { companyId } });
      await prisma.bOQ.deleteMany({ where: { companyId } });
      await prisma.project.deleteMany({ where: { companyId } });
      await prisma.client.deleteMany({ where: { companyId } });
      await prisma.externalConnection.deleteMany({ where: { companyId } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    if (originalEncryptionKey === undefined) {
      delete process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it("imports by slug, persists canonical UUID/private bytes/source audit, survives re-list, and enters extraction", async () => {
    setActorContext(actor);
    const first = await importGoogleDriveFile(actor, {
      googleFileId: "drive-file-integration-1",
      projectId: projectSlug,
    });
    const firstRow = await prisma.projectFile.findUniqueOrThrow({ where: { id: first.file.id } });
    storageKeys.push(firstRow.storageKey);

    expect(firstRow.projectId).toBe(projectId);
    expect(firstRow.storageKey).toContain(`/projects/${projectId}/originals/`);
    expect(await localProjectFileStorageAdapter.getObject(firstRow.storageKey)).toEqual(FILE_BYTES);
    expect(firstRow.metadataJson).toMatchObject({
      importSource: {
        provider: "google-drive",
        externalFileId: "drive-file-integration-1",
        modifiedTime: "2026-08-08T12:00:00.000Z",
      },
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { companyId, entityType: "ProjectFile", entityId: firstRow.id, action: "FILE_UPLOADED" },
    });
    expect(audit.userId).toBe(actor.userId);
    expect(audit.payloadJson).toMatchObject({
      projectId,
      importSource: { provider: "google-drive", externalFileId: "drive-file-integration-1" },
    });
    const publicData = JSON.stringify({ result: first, metadata: firstRow.metadataJson, audit: audit.payloadJson });
    expect(publicData).not.toContain(ACCESS_TOKEN);
    expect(publicData).not.toContain(REFRESH_TOKEN);
    expect(publicData).not.toContain("Authorization");

    const afterRefresh = await listProjectFilesForProject(actor, projectSlug);
    expect(afterRefresh.some((file) => file.id === firstRow.id)).toBe(true);

    const classificationJob = await triggerFileClassification(actor, firstRow.id);
    expect(classificationJob).toMatchObject({ projectId, projectFileId: firstRow.id });

    const repeated = await importGoogleDriveFile(actor, {
      googleFileId: "drive-file-integration-1",
      projectId: projectSlug,
    });
    expect(repeated.duplicateOfFileId).toBe(firstRow.id);
    const repeatedRow = await prisma.projectFile.findUniqueOrThrow({ where: { id: repeated.file.id } });
    storageKeys.push(repeatedRow.storageKey);
    expect(repeatedRow.projectId).toBe(projectId);
    expect(await localProjectFileStorageAdapter.getObject(repeatedRow.storageKey)).toEqual(FILE_BYTES);
    expect(await prisma.projectFile.count({ where: { companyId, projectId } })).toBe(2);
  });
});
