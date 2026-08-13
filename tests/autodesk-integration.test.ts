import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  getConnectionForProvider: vi.fn(),
  getDecryptedCredentialsForConnection: vi.fn(),
  markConnectionDisconnected: vi.fn(),
  recordConnectionError: vi.fn(),
  updateStoredCredentials: vi.fn(),
  upsertConnectedExternalConnection: vi.fn(),
}));

vi.mock("@/lib/repositories/integration-repository", () => repository);

import {
  buildAutodeskAuthorizationUrl,
  exchangeAutodeskAuthorizationCode,
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
  verifyAutodeskOAuthState,
} from "@/lib/services/autodesk-integration-service";

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

describe("Autodesk read-only cloud integration", () => {
  beforeEach(() => {
    vi.stubEnv("AUTODESK_CLIENT_ID", "test-autodesk-client");
    vi.stubEnv("AUTODESK_CLIENT_SECRET", "test-autodesk-secret");
    vi.stubEnv("APP_BASE_URL", "https://quantara.vistabylara.com");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubGlobal("fetch", vi.fn());
    Object.values(repository).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("rejects malformed or mismatched signed OAuth state", () => {
    const { state, cookieValue } = createAutodeskOAuthState(actor);
    expect(() => verifyAutodeskOAuthState(actor, state, cookieValue)).not.toThrow();
    expect(() => verifyAutodeskOAuthState(actor, "different-state", cookieValue)).toThrow(/could not be verified/i);
    expect(() => verifyAutodeskOAuthState(actor, state, "malformed")).toThrow(/could not be verified/i);
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

  it("keeps Autodesk and AutoCAD beta claims limited to cloud browsing and DWG discovery", () => {
    const autodesk = PROVIDER_REGISTRY.find((provider) => provider.id === "autodesk");
    const autocad = PROVIDER_REGISTRY.find((provider) => provider.id === "autocad");

    expect(autodesk).toMatchObject({
      status: "BETA",
      supportedData: ["Autodesk account connection", "Hub and project browsing", "Folder and file browsing"],
    });
    expect(autocad).toMatchObject({
      status: "BETA",
      supportedData: ["DWG cloud file discovery via Autodesk"],
      plannedData: ["Native drawing property extraction", "Quantity extraction"],
    });
    expect(autocad?.supportedData.join(" ")).not.toMatch(/property extraction|quantity extraction/i);
  });

  it("uses the v2 refresh endpoint with the read-only scope", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(json({ access_token: "next-access-token", refresh_token: "next-refresh-token", expires_in: 3600 }));
    await expect(refreshAutodeskAccessToken("refresh-token")).resolves.toMatchObject({ access_token: "next-access-token" });
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options).toMatchObject({ method: "POST" });
    expect(String((options as RequestInit).body)).toContain("scope=data%3Aread");
  });
});
