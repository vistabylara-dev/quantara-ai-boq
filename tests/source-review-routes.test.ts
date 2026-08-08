import { readFileSync } from "node:fs";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  getProjectRecord: vi.fn(),
  listEntitiesForProject: vi.fn(),
  manuallyAddExtractedEntity: vi.fn(),
  confirmExtractedEntity: vi.fn(),
  correctExtractedEntity: vi.fn(),
  rejectExtractedEntity: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
}));

vi.mock("@/lib/repositories/project-repository", () => ({
  getProjectRecord: mocks.getProjectRecord,
}));

vi.mock("@/lib/services/extracted-entity-service", () => ({
  listEntitiesForProject: mocks.listEntitiesForProject,
  manuallyAddExtractedEntity: mocks.manuallyAddExtractedEntity,
  confirmExtractedEntity: mocks.confirmExtractedEntity,
  correctExtractedEntity: mocks.correctExtractedEntity,
  rejectExtractedEntity: mocks.rejectExtractedEntity,
}));

import { GET as listExtractionsGET } from "../src/app/api/projects/[projectId]/extractions/route";
import { POST as confirmExtractionPOST } from "../src/app/api/extractions/[entityId]/confirm/route";
import { POST as correctExtractionPOST } from "../src/app/api/extractions/[entityId]/correct/route";
import { POST as rejectExtractionPOST } from "../src/app/api/extractions/[entityId]/reject/route";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "33333333-3333-4333-8333-333333333333";

const actor = {
  userId: "44444444-4444-4444-8444-444444444444",
  companyId: COMPANY_ID,
  role: UserRole.COMPANY_OWNER,
  fullName: "Source Reviewer",
  email: "source-reviewer@example.com",
};

function actionRequest(pathname: string, body: unknown) {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Release 1 extraction review API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
    mocks.getProjectRecord.mockResolvedValue({ id: PROJECT_ID, slug: "dubai-tower" });
  });

  it("resolves a project slug to its canonical UUID before listing tenant-scoped extractions", async () => {
    const entities = [{ id: ENTITY_ID, projectId: PROJECT_ID, status: "NEEDS_REVIEW" }];
    mocks.listEntitiesForProject.mockResolvedValue(entities);

    const response = await listExtractionsGET(
      new Request("http://localhost/api/projects/dubai-tower/extractions?status=NEEDS_REVIEW&entityType=ROOM"),
      { params: Promise.resolve({ projectId: "dubai-tower" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(mocks.getProjectRecord).toHaveBeenCalledWith(COMPANY_ID, "dubai-tower");
    expect(mocks.listEntitiesForProject).toHaveBeenCalledWith(actor, PROJECT_ID, {
      status: "NEEDS_REVIEW",
      entityType: "ROOM",
    });
    expect(await response.json()).toEqual({ ok: true, data: entities });
  });

  it("confirms an extracted candidate through the existing action without a request body", async () => {
    const confirmed = { id: ENTITY_ID, status: "CONFIRMED" };
    mocks.confirmExtractedEntity.mockResolvedValue(confirmed);

    const response = await confirmExtractionPOST(
      new Request(`http://localhost/api/extractions/${ENTITY_ID}/confirm`, { method: "POST" }),
      { params: Promise.resolve({ entityId: ENTITY_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.confirmExtractedEntity).toHaveBeenCalledWith(actor, ENTITY_ID);
    expect(await response.json()).toEqual({ ok: true, data: confirmed });
  });

  it.each([
    ["missing", { label: "Corrected label" }],
    ["blank", { label: "Corrected label", reason: "   " }],
  ])("rejects a %s correction reason before calling the service", async (_case, body) => {
    const response = await correctExtractionPOST(
      actionRequest(`/api/extractions/${ENTITY_ID}/correct`, body),
      { params: Promise.resolve({ entityId: ENTITY_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", fieldErrors: { reason: expect.any(Array) } },
    });
    expect(mocks.correctExtractedEntity).not.toHaveBeenCalled();
  });

  it("accepts only the supported correction fields and trims the mandatory reason", async () => {
    const corrected = { id: ENTITY_ID, status: "CORRECTED" };
    mocks.correctExtractedEntity.mockResolvedValue(corrected);
    const response = await correctExtractionPOST(
      actionRequest(`/api/extractions/${ENTITY_ID}/correct`, {
        label: "  Corrected wall finish  ",
        quantity: 18.5,
        unit: "m2",
        reason: "  Checked against drawing A-101.  ",
      }),
      { params: Promise.resolve({ entityId: ENTITY_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.correctExtractedEntity).toHaveBeenCalledWith(actor, ENTITY_ID, {
      label: "Corrected wall finish",
      quantity: 18.5,
      unit: "m2",
      reason: "Checked against drawing A-101.",
    });
    expect(await response.json()).toEqual({ ok: true, data: corrected });
  });

  it.each([
    ["missing", {}],
    ["blank", { reason: "   " }],
  ])("requires a %s rejection reason", async (_case, body) => {
    const response = await rejectExtractionPOST(
      actionRequest(`/api/extractions/${ENTITY_ID}/reject`, body),
      { params: Promise.resolve({ entityId: ENTITY_ID }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.rejectExtractedEntity).not.toHaveBeenCalled();
  });

  it("rejects a candidate with the trimmed professional-review reason", async () => {
    const rejected = { id: ENTITY_ID, status: "REJECTED" };
    mocks.rejectExtractedEntity.mockResolvedValue(rejected);
    const response = await rejectExtractionPOST(
      actionRequest(`/api/extractions/${ENTITY_ID}/reject`, {
        reason: "  Not supported by the source drawing.  ",
      }),
      { params: Promise.resolve({ entityId: ENTITY_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.rejectExtractedEntity).toHaveBeenCalledWith(
      actor,
      ENTITY_ID,
      "Not supported by the source drawing.",
    );
    expect(await response.json()).toEqual({ ok: true, data: rejected });
  });

  it("keeps the human-review page isolated from every BOQ import path", () => {
    const pageSource = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/extractions/page.tsx"),
      "utf8",
    );

    expect(pageSource).not.toContain("import-to-boq");
    expect(pageSource).not.toContain("extraction-to-boq-service");
    expect(pageSource).not.toContain("importExtractedEntityToBoq");
  });
});
