import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors/app-error";

const repository = vi.hoisted(() => ({
  getConnectionForProvider: vi.fn(),
  getDecryptedCredentialsForConnection: vi.fn(),
  markConnectionDisconnected: vi.fn(),
  recordConnectionError: vi.fn(),
  updateStoredCredentials: vi.fn(),
  upsertConnectedExternalConnection: vi.fn(),
}));

const candidateStore = vi.hoisted(() => {
  const state: { files: Record<string, unknown>[]; entities: Record<string, unknown>[]; nextId: number } = {
    files: [],
    entities: [],
    nextId: 1,
  };
  const tx = {
    $executeRaw: vi.fn(),
    projectFile: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    extractedEntity: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };
  const prisma = { $transaction: vi.fn() };
  return { state, tx, prisma };
});

const projectRepository = vi.hoisted(() => ({ getProjectRecord: vi.fn() }));
const auditRepository = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
const integrationEntitlements = vi.hoisted(() => ({ getIntegrationEntitlements: vi.fn() }));

vi.mock("@/lib/repositories/integration-repository", () => repository);
vi.mock("@/lib/db/prisma", () => ({ prisma: candidateStore.prisma }));
vi.mock("@/lib/repositories/project-repository", () => projectRepository);
vi.mock("@/lib/repositories/audit-repository", () => auditRepository);
vi.mock("@/lib/entitlements/integration-entitlement-service", () => integrationEntitlements);

import {
  buildAutodeskAuthorizationUrl,
  exchangeAutodeskAuthorizationCode,
  getAutodeskDerivativeManifest,
  getAutodeskItemTipVersion,
  getAutodeskModelMetadata,
  getAutodeskModelProperties,
  listAutodeskFolderContents,
  listAutodeskHubs,
  listAutodeskProjects,
  listAutodeskTopFolders,
  refreshAutodeskAccessToken,
} from "@/lib/integrations/connectors/autodesk-client";
import { PROVIDER_REGISTRY } from "@/lib/integrations/provider-registry";
import {
  browseAutodeskHubs,
  completeAutodeskConnection,
  createAutodeskOAuthState,
  getAutodeskRuntimeStatus,
  verifyAutodeskOAuthState,
} from "@/lib/services/autodesk-integration-service";
import { generateAutodeskDwgCandidates } from "@/lib/services/autodesk-candidate-service";

const actor = {
  userId: "user-1",
  companyId: "company-1",
  role: "COMPANY_OWNER" as const,
  fullName: "Test Owner",
  email: "owner@example.test",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function configureCandidateStore() {
  candidateStore.state.files.splice(0);
  candidateStore.state.entities.splice(0);
  candidateStore.state.nextId = 1;
  candidateStore.tx.$executeRaw.mockResolvedValue(0);
  candidateStore.tx.projectFile.findMany.mockImplementation(async ({ where }: { where: { companyId: string; projectId: string } }) => (
    candidateStore.state.files.filter((file) => file.companyId === where.companyId && file.projectId === where.projectId)
  ));
  candidateStore.tx.projectFile.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const row = { id: `00000000-0000-4000-8000-${String(candidateStore.state.nextId++).padStart(12, "0")}`, ...data };
    candidateStore.state.files.push(row);
    return row;
  });
  candidateStore.tx.extractedEntity.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => (
    candidateStore.state.entities.filter((entity) => (
      entity.companyId === where.companyId
      && entity.projectId === where.projectId
      && entity.projectFileId === where.projectFileId
      && entity.extractionMethod === where.extractionMethod
    ))
  ));
  candidateStore.tx.extractedEntity.deleteMany.mockImplementation(async ({ where }: { where: { id?: { in?: string[] } } }) => {
    const ids = new Set(where.id?.in ?? []);
    const before = candidateStore.state.entities.length;
    for (let index = candidateStore.state.entities.length - 1; index >= 0; index -= 1) {
      if (ids.has(String(candidateStore.state.entities[index].id))) candidateStore.state.entities.splice(index, 1);
    }
    return { count: before - candidateStore.state.entities.length };
  });
  candidateStore.tx.extractedEntity.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const row = { id: `entity-${candidateStore.state.nextId++}`, ...data };
    candidateStore.state.entities.push(row);
    return row;
  });
  candidateStore.prisma.$transaction.mockImplementation(async (operation: (tx: typeof candidateStore.tx) => Promise<unknown>) => operation(candidateStore.tx));
}

function configureConnectedAutodeskCredential() {
  repository.getConnectionForProvider.mockResolvedValue({ id: "connection-1", status: "CONNECTED" });
  repository.getDecryptedCredentialsForConnection.mockResolvedValue({
    accessToken: "server-only-access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scope: "data:read",
    tokenType: "Bearer",
  });
}

function mockCandidatePipeline() {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(json({
      data: {
        type: "versions",
        id: "version-1",
        attributes: { name: "floor-plan.dwg", mimeType: "application/acad", versionNumber: 7 },
        relationships: { derivatives: { data: { type: "derivatives", id: "derivative-urn" } } },
      },
    }))
    .mockResolvedValueOnce(json({ status: "success", progress: "complete", type: "manifest", derivatives: [] }))
    .mockResolvedValueOnce(json({
      data: { type: "metadata", metadata: [{ name: "Model", guid: "model-3d", role: "3d" }] },
    }))
    .mockResolvedValueOnce(json({
      data: {
        type: "properties",
        collection: [{
          objectid: 17,
          name: "Polyline [2C1]",
          externalId: "ext-17",
          properties: {
            General: { Layer: "A-WALL", Name: "3D Polyline", Handle: 1234, Color: 7 },
            Geometry: { Length: "3765.836 mm", Area: "10.2 mÂ²", Volume: "0.6 mÂ³" },
            Material: { Material: "Concrete" },
          },
        }],
      },
    }));
}

describe("Autodesk read-only cloud integration", () => {
  beforeEach(() => {
    vi.stubEnv("AUTODESK_CLIENT_ID", "test-autodesk-client");
    vi.stubEnv("AUTODESK_CLIENT_SECRET", "test-autodesk-secret");
    vi.stubEnv("APP_BASE_URL", "https://quantara.vistabylara.com");
    vi.stubEnv(
      "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY",
      "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
    );
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubGlobal("fetch", vi.fn());
    Object.values(repository).forEach((mock) => mock.mockReset());
    configureCandidateStore();
    projectRepository.getProjectRecord.mockReset();
    projectRepository.getProjectRecord.mockResolvedValue({ id: "project-db", slug: "project-slug" });
    auditRepository.createAuditLog.mockReset();
    auditRepository.createAuditLog.mockResolvedValue(undefined);
    integrationEntitlements.getIntegrationEntitlements.mockReset();
    integrationEntitlements.getIntegrationEntitlements.mockResolvedValue({
      allowedProviderFamilies: ["autodesk", "google"],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("blocks Autodesk OAuth and browsing when the current plan excludes Autodesk", async () => {
    integrationEntitlements.getIntegrationEntitlements.mockResolvedValue({
      allowedProviderFamilies: ["google"],
    });

    await expect(createAutodeskOAuthState(actor)).rejects.toMatchObject({
      code: "INTEGRATION_NOT_ENTITLED",
    });

    configureConnectedAutodeskCredential();
    await expect(browseAutodeskHubs(actor)).rejects.toMatchObject({
      code: "INTEGRATION_NOT_ENTITLED",
    });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("builds the APS v2 authorization URL with the exact callback, read-only scope, and state", () => {
    const url = new URL(buildAutodeskAuthorizationUrl("opaque-state"));
    expect(url.origin + url.pathname).toBe("https://developer.api.autodesk.com/authentication/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-autodesk-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://quantara.vistabylara.com/api/integrations/autodesk/callback");
    expect(url.searchParams.get("scope")).toBe("data:read");
    expect(url.searchParams.get("state")).toBe("opaque-state");
    expect(url.searchParams.has("data:write")).toBe(false);
  });

  it("starts Autodesk browser authorization before the provider client secret is needed", async () => {
    vi.stubEnv("AUTODESK_CLIENT_SECRET", "");

    const { state } = await createAutodeskOAuthState(actor);
    const url = new URL(buildAutodeskAuthorizationUrl(state));

    expect(url.origin + url.pathname).toBe(
      "https://developer.api.autodesk.com/authentication/v2/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("test-autodesk-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://quantara.vistabylara.com/api/integrations/autodesk/callback",
    );
    expect(url.searchParams.get("scope")).toBe("data:read");
  });

  it("rejects malformed or mismatched signed OAuth state", async () => {
    const { state, cookieValue } = await createAutodeskOAuthState(actor);
    await expect(verifyAutodeskOAuthState(actor, state, cookieValue)).resolves.toEqual({
      projectId: null,
      intent: null,
      returnTo: null,
    });
    await expect(verifyAutodeskOAuthState(actor, "different-state", cookieValue)).rejects.toThrow(/could not be verified/i);
    await expect(verifyAutodeskOAuthState(actor, state, "malformed")).rejects.toThrow(/could not be verified/i);
  });

  it("round-trips validated BOQ-source project context through signed Autodesk OAuth state", async () => {
    const { state, cookieValue } = await createAutodeskOAuthState(actor, {
      projectId: "project-slug",
      intent: "boq-source",
      returnTo: "/projects/project-slug/boq",
    });

    await expect(verifyAutodeskOAuthState(actor, state, cookieValue)).resolves.toEqual({
      projectId: "project-slug",
      intent: "boq-source",
      returnTo: "/projects/project-slug/boq",
    });
  });

  it("exchanges a code server-side, validates data:read, and persists credentials without returning them", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      }))
      .mockResolvedValueOnce(json({
        active: true,
        scope: "data:read",
        client_id: "test-autodesk-client",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }))
      .mockResolvedValueOnce(json({ data: [] }));
    repository.upsertConnectedExternalConnection.mockResolvedValue({ id: "connection-1" });

    const token = await exchangeAutodeskAuthorizationCode("authorization-code");
    expect(token.access_token).toBe("access-token");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://developer.api.autodesk.com/authentication/v2/token");

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      }))
      .mockResolvedValueOnce(json({
        active: true,
        scope: "data:read",
        client_id: "test-autodesk-client",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }))
      .mockResolvedValueOnce(json({ data: [] }));

    const completion = await completeAutodeskConnection(actor, "authorization-code");
    expect(completion).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(repository.upsertConnectedExternalConnection).toHaveBeenCalledWith(expect.objectContaining({
      companyId: actor.companyId,
      connectedByUserId: actor.userId,
      providerId: "autodesk",
      grantedScopesJson: ["data:read"],
      credentials: expect.objectContaining({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        scope: "data:read",
        tokenType: "Bearer",
      }),
    }));
    expect(JSON.stringify(completion)).toBeUndefined();
  });

  it("reports CONNECTED from token introspection without requiring hub access", async () => {
    configureConnectedAutodeskCredential();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(json({
      active: true,
      scope: "data:read",
      client_id: "test-autodesk-client",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    await expect(getAutodeskRuntimeStatus(actor)).resolves.toMatchObject({
      connectionStatus: "CONNECTED",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports Autodesk hub provisioning separately from OAuth authorization", async () => {
    configureConnectedAutodeskCredential();

    vi.mocked(fetch).mockResolvedValueOnce(json({}, 403));

    await expect(browseAutodeskHubs(actor)).rejects.toMatchObject({
      code: "AUTODESK_HUB_ACCESS_REQUIRED",
      message: expect.stringContaining("custom integration"),
    });
  });

  it("refreshes an expiring encrypted credential before browsing hubs", async () => {
    const fetchMock = vi.mocked(fetch);
    repository.getConnectionForProvider.mockResolvedValue({ id: "connection-1", status: "CONNECTED" });
    repository.getDecryptedCredentialsForConnection.mockResolvedValue({
      accessToken: "expired-access-token",
      refreshToken: "old-refresh-token",
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      scope: "data:read",
      tokenType: "Bearer",
    });
    repository.updateStoredCredentials.mockResolvedValue(undefined);
    fetchMock
      .mockResolvedValueOnce(json({
        access_token: "refreshed-access-token",
        refresh_token: "rotated-refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      }))
      .mockResolvedValueOnce(json({
        active: true,
        scope: "data:read",
        client_id: "test-autodesk-client",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }))
      .mockResolvedValueOnce(json({ data: [{ id: "hub-1", type: "hubs", attributes: { name: "Main Hub" } }] }));

    await expect(browseAutodeskHubs(actor)).resolves.toEqual([{ id: "hub-1", name: "Main Hub", type: "hubs" }]);
    expect(repository.updateStoredCredentials).toHaveBeenCalledWith(
      actor.companyId,
      "connection-1",
      expect.objectContaining({ accessToken: "refreshed-access-token", refreshToken: "rotated-refresh-token", scope: "data:read" }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://developer.api.autodesk.com/authentication/v2/token");
  });

  it("parses hubs, projects, folders, and DWG files from APS Data Management responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json({ data: [{ id: "hub-1", type: "hubs", attributes: { name: "Main Hub" } }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "project-1", type: "projects", attributes: { name: "Tower" } }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "folder-1", type: "folders", attributes: { name: "Plans" } }] }))
      .mockResolvedValueOnce(json({
        data: [
          { id: "folder-2", type: "folders", attributes: { name: "Issued" } },
          { id: "item-1", type: "items", relationships: { tip: { data: { id: "version-1", type: "versions" } } } },
        ],
        included: [{ id: "version-1", type: "versions", attributes: { name: "floor-plan.DWG" } }],
      }));

    await expect(listAutodeskHubs("access-token")).resolves.toEqual([{ id: "hub-1", name: "Main Hub", type: "hubs" }]);
    await expect(listAutodeskProjects("access-token", "hub-1")).resolves.toEqual([{ id: "project-1", name: "Tower", type: "projects" }]);
    await expect(listAutodeskTopFolders("access-token", "hub-1", "project-1")).resolves.toEqual([
      { id: "folder-1", name: "Plans", type: "folder", isFolder: true, isFile: false, isDwg: false },
    ]);
    await expect(listAutodeskFolderContents("access-token", "project-1", "folder-1")).resolves.toEqual([
      { id: "folder-2", name: "Issued", type: "folder", isFolder: true, isFile: false, isDwg: false },
      { id: "item-1", name: "floor-plan.DWG", type: "file", isFolder: false, isFile: true, isDwg: true },
    ]);
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("/data/v1/projects/project-1/folders/folder-1/contents");
  });

  it("limits Autodesk and AutoCAD beta claims to the shipped, human-review DWG flow", () => {
    const autodesk = PROVIDER_REGISTRY.find((provider) => provider.id === "autodesk");
    const autocad = PROVIDER_REGISTRY.find((provider) => provider.id === "autocad");

    expect(autodesk).toMatchObject({
      status: "BETA",
      supportedData: ["Autodesk account connection", "Hub and project browsing", "Folder and file browsing", "Reviewable DWG metadata extraction candidates"],
    });
    expect(autocad).toMatchObject({
      status: "BETA",
      supportedData: ["DWG cloud file discovery via Autodesk", "Reviewable DWG metadata extraction candidates"],
      plannedData: ["Human-reviewed quantity takeoff"],
    });
    expect(autocad?.supportedData.join(" ")).not.toMatch(/automatic BOQ|model viewer|quantity extraction/i);
  });

  it("uses the v2 refresh endpoint with the read-only scope", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(json({ access_token: "next-access-token", refresh_token: "next-refresh-token", expires_in: 3600 }));
    await expect(refreshAutodeskAccessToken("refresh-token")).resolves.toMatchObject({ access_token: "next-access-token" });
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options).toMatchObject({ method: "POST" });
    expect(String((options as RequestInit).body)).toContain("scope=data%3Aread");
  });

  it("resolves a DWG tip directly or from exactly one declared version reference without inferring a URN", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json({
        data: {
          type: "versions",
          id: "urn:version?tip=1",
          attributes: { name: "A101.dwg", mimeType: "application/acad", versionNumber: 7 },
          relationships: { derivatives: { data: { type: "derivatives", id: "direct-urn" } } },
        },
      }))
      .mockResolvedValueOnce(json({
        data: {
          type: "versions",
          id: "urn:version?tip=2",
          attributes: { name: "A102.dwg", versionNumber: 8 },
        },
      }))
      .mockResolvedValueOnce(json({
        included: [{
          type: "versions",
          id: "urn:version?tip=2",
          relationships: { derivatives: { data: { type: "derivatives", id: "fallback-urn" } } },
        }],
      }));

    await expect(getAutodeskItemTipVersion("access-token", "project/a", "item/a")).resolves.toEqual({
      itemId: "item/a",
      versionId: "urn:version?tip=1",
      name: "A101.dwg",
      mimeType: "application/acad",
      versionNumber: 7,
      derivativeUrn: "direct-urn",
    });
    await expect(getAutodeskItemTipVersion("access-token", "project/a", "item/a")).resolves.toMatchObject({
      versionId: "urn:version?tip=2",
      derivativeUrn: "fallback-urn",
    });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("versions/urn%3Aversion%3Ftip%3D2/relationships/refs");
  });

  it("validates completed derivative metadata and preserves only raw APS property evidence", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json({ status: "success", progress: "complete", type: "manifest" }))
      .mockResolvedValueOnce(json({
        data: { type: "metadata", metadata: [{ name: "Model", guid: "model-3d", role: "3d", isMasterView: true }] },
      }))
      .mockResolvedValueOnce(json({
        data: {
          type: "properties",
          collection: [{
            objectid: 17,
            name: "Polyline [2C1]",
            externalId: "ext-17",
            properties: { General: { Layer: "A-WALL", Handle: 1234 }, Geometry: { Length: "3765.836 mm", Area: "10.2 mÂ²" } },
          }],
        },
      }));

    await expect(getAutodeskDerivativeManifest("access-token", "derivative-urn")).resolves.toEqual({ status: "success", progress: "complete" });
    await expect(getAutodeskModelMetadata("access-token", "derivative-urn")).resolves.toEqual([
      { modelGuid: "model-3d", name: "Model", role: "3d", isMasterView: true },
    ]);
    await expect(getAutodeskModelProperties("access-token", "derivative-urn", "model-3d")).resolves.toEqual([
      {
        objectId: 17,
        name: "Polyline [2C1]",
        externalId: "ext-17",
        properties: { General: { Layer: "A-WALL", Handle: 1234 }, Geometry: { Length: "3765.836 mm", Area: "10.2 mÂ²" } },
      },
    ]);
  });

  it("maps an incomplete Autodesk derivative to the controlled not-ready response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ status: "inprogress", progress: "75%" }));
    await expect(getAutodeskDerivativeManifest("access-token", "derivative-urn")).rejects.toMatchObject({
      code: "AUTODESK_DERIVATIVE_NOT_READY",
      message: "Autodesk model metadata is not available for this DWG version yet.",
    });

    vi.mocked(fetch).mockResolvedValueOnce(json({}, 202));
    await expect(getAutodeskDerivativeManifest("access-token", "derivative-urn")).rejects.toMatchObject({
      code: "AUTODESK_DERIVATIVE_NOT_READY",
      message: "Autodesk model metadata is not available for this DWG version yet.",
    });
  });

  it("creates only NEEDS_REVIEW DWG candidates with metadata-only provenance and protects reviewed reruns", async () => {
    configureConnectedAutodeskCredential();
    mockCandidatePipeline();

    const first = await generateAutodeskDwgCandidates(actor, {
      projectId: "project-slug",
      autodeskProjectId: "aps-project-1",
      itemId: "item-1",
    });

    expect(first).toMatchObject({ candidatesCreated: 1, candidatesPreserved: 0, modelsProcessed: 1 });
    expect(candidateStore.state.files).toHaveLength(1);
    expect(candidateStore.state.files[0]).toMatchObject({
      fileSize: 0,
      storageKey: expect.stringMatching(/^external-references\/autodesk\//),
      metadataJson: expect.objectContaining({ sourceKind: "EXTERNAL_REFERENCE", localCopy: false }),
    });
    expect(candidateStore.state.entities).toHaveLength(1);
    expect(candidateStore.state.entities[0]).toMatchObject({
      projectId: "project-db",
      entityType: "CUSTOM",
      extractionMethod: "VECTOR_BLOCK",
      status: "NEEDS_REVIEW",
      quantity: null,
      unit: null,
      technicalDataJson: expect.objectContaining({
        provider: "autodesk",
        sourceFormat: "DWG",
        autodeskProjectId: "aps-project-1",
        itemId: "item-1",
        versionId: "version-1",
        derivativeUrn: "derivative-urn",
        modelGuid: "model-3d",
        objectId: 17,
        externalId: "ext-17",
        layer: "A-WALL",
        properties: expect.objectContaining({ Geometry: expect.objectContaining({ Length: "3765.836 mm", Area: "10.2 mÂ²", Volume: "0.6 mÂ³" }) }),
      }),
    });
    expect(JSON.stringify({ first, files: candidateStore.state.files, entities: candidateStore.state.entities })).not.toMatch(/server-only-access-token|Bearer /);

    mockCandidatePipeline();
    await expect(generateAutodeskDwgCandidates(actor, {
      projectId: "project-slug",
      autodeskProjectId: "aps-project-1",
      itemId: "item-1",
    })).resolves.toMatchObject({ candidatesCreated: 1, candidatesPreserved: 0 });
    expect(candidateStore.state.entities).toHaveLength(1);

    candidateStore.state.entities[0].status = "CONFIRMED";
    mockCandidatePipeline();
    await expect(generateAutodeskDwgCandidates(actor, {
      projectId: "project-slug",
      autodeskProjectId: "aps-project-1",
      itemId: "item-1",
    })).resolves.toMatchObject({ candidatesCreated: 0, candidatesPreserved: 1 });
    expect(candidateStore.state.entities).toHaveLength(1);
    expect(candidateStore.state.entities[0].status).toBe("CONFIRMED");
  });

  it("rejects a non-DWG before model calls or candidate persistence", async () => {
    configureConnectedAutodeskCredential();
    vi.mocked(fetch).mockResolvedValueOnce(json({
      data: {
        type: "versions",
        id: "version-pdf",
        attributes: { name: "schedule.pdf", versionNumber: 1 },
        relationships: { derivatives: { data: { type: "derivatives", id: "unused-derivative" } } },
      },
    }));

    await expect(generateAutodeskDwgCandidates(actor, {
      projectId: "project-slug",
      autodeskProjectId: "aps-project-1",
      itemId: "item-pdf",
    })).rejects.toMatchObject({ code: "AUTODESK_DWG_REQUIRED" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(candidateStore.state.files).toHaveLength(0);
    expect(candidateStore.state.entities).toHaveLength(0);
  });

  it("resolves the tenant-owned Quantara project before making any Autodesk request", async () => {
    configureConnectedAutodeskCredential();
    projectRepository.getProjectRecord.mockRejectedValueOnce(new NotFoundError("Project not found."));

    await expect(generateAutodeskDwgCandidates(actor, {
      projectId: "other-company-project",
      autodeskProjectId: "aps-project-1",
      itemId: "item-1",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(candidateStore.state.files).toHaveLength(0);
    expect(candidateStore.state.entities).toHaveLength(0);
  });
});
