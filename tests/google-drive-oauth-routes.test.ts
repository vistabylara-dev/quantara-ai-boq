import { readFileSync } from "node:fs";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  createGoogleDriveOAuthState: vi.fn(),
  initiateGoogleDriveConnection: vi.fn(),
  verifyGoogleDriveOAuthState: vi.fn(),
  completeGoogleDriveConnection: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  })),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
}));

vi.mock("@/lib/services/google-drive-integration-service", () => ({
  STATE_COOKIE_NAME: "google_drive_oauth_state",
  createGoogleDriveOAuthState: mocks.createGoogleDriveOAuthState,
  initiateGoogleDriveConnection: mocks.initiateGoogleDriveConnection,
  verifyGoogleDriveOAuthState: mocks.verifyGoogleDriveOAuthState,
  completeGoogleDriveConnection: mocks.completeGoogleDriveConnection,
}));

import { GET as connect } from "../src/app/api/integrations/google-drive/connect/route";
import { GET as callback } from "../src/app/api/integrations/google-drive/callback/route";

const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  companyId: "11111111-1111-4111-8111-111111111111",
  role: UserRole.COMPANY_OWNER,
  fullName: "OAuth Route Test",
  email: "oauth-route@example.com",
};

describe("Google Drive OAuth browser routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
    mocks.createGoogleDriveOAuthState.mockResolvedValue({
      state: "provider-state",
      cookieValue: "signed-actor-bound-cookie",
    });
    mocks.initiateGoogleDriveConnection.mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth?state=provider-state",
    );
    mocks.cookieGet.mockReturnValue({ value: "signed-actor-bound-cookie" });
    mocks.verifyGoogleDriveOAuthState.mockResolvedValue({ projectId: null, intent: null, returnTo: null });
    mocks.completeGoogleDriveConnection.mockResolvedValue(undefined);
  });

  it("starts OAuth with a full browser redirect and a protected short-lived state cookie", async () => {
    const response = await connect(new Request("https://quantara.example/api/integrations/google-drive/connect"));

    expect(response.headers.get("location")).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "google_drive_oauth_state",
      "signed-actor-bound-cookie",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 }),
    );

    const panelSource = readFileSync(
      "src/app/integrations/google-drive/connect/google-drive-connect-panel.tsx",
      "utf8",
    );
    expect(panelSource).toContain('withProjectContext("/api/integrations/google-drive/connect", projectContext)');
    expect(panelSource).not.toContain("apiClient.get(\"/api/integrations/google-drive/connect");
  });

  it("forwards projectId/intent/returnTo off the query string into the signed OAuth state", async () => {
    await connect(new Request(
      "https://quantara.example/api/integrations/google-drive/connect?projectId=proj-1&intent=boq-source&returnTo=%2Fprojects%2Fproj-1%2Fboq",
    ));

    expect(mocks.createGoogleDriveOAuthState).toHaveBeenCalledWith(actor, {
      projectId: "proj-1",
      intent: "boq-source",
      returnTo: "/projects/proj-1/boq",
    });
  });

  it("restores first-OAuth project context onto the connect-page redirect after a successful callback", async () => {
    mocks.verifyGoogleDriveOAuthState.mockResolvedValue({
      projectId: "proj-1",
      intent: "boq-source",
      returnTo: "/projects/proj-1/boq",
    });

    const response = await callback(new Request(
      "https://quantara.example/api/integrations/google-drive/callback?code=one-time-secret-code&state=provider-state",
    ));
    const location = response.headers.get("location") ?? "";

    expect(location).toContain("projectId=proj-1");
    expect(location).toContain("intent=boq-source");
    expect(location).toContain(`returnTo=${encodeURIComponent("/projects/proj-1/boq")}`);
    expect(location).toContain("connected=1");
    expect(location.startsWith("https://quantara.example/integrations/google-drive/connect")).toBe(true);
  });

  it("restores first-OAuth project context onto the connect-page redirect after a failed callback", async () => {
    mocks.verifyGoogleDriveOAuthState.mockResolvedValue({
      projectId: "proj-1",
      intent: "boq-source",
      returnTo: "/projects/proj-1/boq",
    });
    mocks.completeGoogleDriveConnection.mockRejectedValue(
      new AppError("GOOGLE_DRIVE_TOKEN_ERROR", "token exchange failed", 400),
    );

    const response = await callback(new Request(
      "https://quantara.example/api/integrations/google-drive/callback?code=one-time-secret-code&state=provider-state",
    ));
    const location = response.headers.get("location") ?? "";

    expect(location).toContain("projectId=proj-1");
    expect(location).toContain("intent=boq-source");
    expect(location).toContain(`returnTo=${encodeURIComponent("/projects/proj-1/boq")}`);
    expect(location).toContain("connectError=GOOGLE_DRIVE_TOKEN_ERROR");
  });

  it("rejects missing or invalid state with a controlled code and consumes the cookie", async () => {
    mocks.verifyGoogleDriveOAuthState.mockImplementation(() => {
      throw new AppError(
        "GOOGLE_DRIVE_OAUTH_STATE_MISMATCH",
        "sensitive internal state detail",
        400,
      );
    });

    const response = await callback(new Request(
      "https://quantara.example/api/integrations/google-drive/callback?code=secret-code",
    ));
    const location = response.headers.get("location") ?? "";

    expect(mocks.cookieDelete).toHaveBeenCalledWith("google_drive_oauth_state");
    expect(location).toContain("connectError=GOOGLE_DRIVE_OAUTH_STATE_MISMATCH");
    expect(location).not.toContain("sensitive");
    expect(mocks.completeGoogleDriveConnection).not.toHaveBeenCalled();
  });

  it("maps authorization denial to controlled UI state after CSRF validation", async () => {
    const response = await callback(new Request(
      "https://quantara.example/api/integrations/google-drive/callback?error=access_denied&state=provider-state&error_description=private-provider-detail",
    ));
    const location = response.headers.get("location") ?? "";

    expect(mocks.verifyGoogleDriveOAuthState).toHaveBeenCalledWith(
      actor,
      "provider-state",
      "signed-actor-bound-cookie",
    );
    expect(location).toContain("connectError=GOOGLE_DRIVE_AUTH_DENIED");
    expect(location).not.toContain("private-provider-detail");
  });

  it("stores authorization server-side and returns no code or token to the browser", async () => {
    const response = await callback(new Request(
      "https://quantara.example/api/integrations/google-drive/callback?code=one-time-secret-code&state=provider-state",
    ));
    const location = response.headers.get("location") ?? "";

    expect(mocks.completeGoogleDriveConnection).toHaveBeenCalledWith(actor, "one-time-secret-code");
    expect(location).toBe("https://quantara.example/integrations/google-drive/connect?connected=1");
    expect(location).not.toContain("one-time-secret-code");
    expect(location).not.toContain("access_token");
    expect(location).not.toContain("refresh_token");
  });

  it("keeps Google Drive native and preserves selected import through ProjectFile", () => {
    const serviceSource = readFileSync("src/lib/services/google-drive-integration-service.ts", "utf8");
    expect(serviceSource).toContain("uploadProjectFile(actor, project.id");
    expect(serviceSource).toContain("getGoogleDriveFileMetadata");
    expect(serviceSource).not.toContain("arcade-runtime");
    expect(serviceSource).not.toContain("createBOQ");
  });
});
