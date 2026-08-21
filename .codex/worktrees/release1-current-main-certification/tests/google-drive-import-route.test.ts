import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  importGoogleDriveFile: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
}));

vi.mock("@/lib/services/google-drive-integration-service", () => ({
  importGoogleDriveFile: mocks.importGoogleDriveFile,
}));

import { POST } from "../src/app/api/integrations/google-drive/import/route";

const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  companyId: "11111111-1111-4111-8111-111111111111",
  role: UserRole.COMPANY_OWNER,
  fullName: "Route Test",
  email: "route@example.com",
};

describe("POST /api/integrations/google-drive/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
    mocks.importGoogleDriveFile.mockResolvedValue({
      file: { id: "project-file-1" },
      duplicateOfFileId: null,
    });
  });

  it("rejects malformed JSON without invoking the import service", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/google-drive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
    expect(mocks.importGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("strictly rejects unknown JSON fields", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/google-drive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleFileId: "file-1", projectId: "project-slug", unexpected: true }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.importGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("sets actor context, trims the strict contract, and returns the service result with 201", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/google-drive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleFileId: "  file-1  ", projectId: "  project-slug  " }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(mocks.importGoogleDriveFile).toHaveBeenCalledWith(actor, {
      googleFileId: "file-1",
      projectId: "project-slug",
    });
    expect(body).toMatchObject({ ok: true, data: { duplicateOfFileId: null } });
  });
});
