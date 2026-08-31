import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionDeniedError, UnauthorizedError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  listFurnitureCandidates: vi.fn(),
  correctFurnitureCandidate: vi.fn(),
  approveFurnitureCandidate: vi.fn(),
  listFurnitureOrderItemCandidates: vi.fn(),
  correctFurnitureOrderItemCandidate: vi.fn(),
  approveFurnitureOrderItemCandidate: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: mocks.getCurrentActor,
}));

vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
  withActorRequestContext: <T extends (...args: never[]) => unknown>(handler: T) => handler,
}));

vi.mock("@/lib/services/furniture-review-service", () => ({
  listFurnitureCandidates: mocks.listFurnitureCandidates,
  correctFurnitureCandidate: mocks.correctFurnitureCandidate,
  approveFurnitureCandidate: mocks.approveFurnitureCandidate,
}));

vi.mock("@/lib/services/furniture-order-review-service", () => ({
  listFurnitureOrderItemCandidates: mocks.listFurnitureOrderItemCandidates,
  correctFurnitureOrderItemCandidate: mocks.correctFurnitureOrderItemCandidate,
  approveFurnitureOrderItemCandidate: mocks.approveFurnitureOrderItemCandidate,
}));

import { GET as listCandidatesGET } from "@/app/api/projects/[projectId]/furniture/candidates/route";
import { PATCH as correctCandidatePATCH } from "@/app/api/projects/[projectId]/furniture/candidates/[candidateId]/route";
import { POST as approveCandidatePOST } from "@/app/api/projects/[projectId]/furniture/candidates/[candidateId]/approve/route";
import { GET as listOrderItemsGET } from "@/app/api/projects/[projectId]/furniture/order-items/route";
import { PATCH as correctOrderItemPATCH } from "@/app/api/projects/[projectId]/furniture/order-items/[candidateId]/route";
import { POST as approveOrderItemPOST } from "@/app/api/projects/[projectId]/furniture/order-items/[candidateId]/approve/route";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_ID = "22222222-2222-4222-8222-222222222222";
const actor = {
  userId: "33333333-3333-4333-8333-333333333333",
  companyId: COMPANY_ID,
  role: UserRole.REVIEWER,
  fullName: "Controlled Reviewer",
  email: "controlled-reviewer@example.test",
};

function request(method: "PATCH" | "POST", pathname: string, body: unknown): Request {
  return new Request(`http://localhost${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Furniture review route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
  });

  it("requires an authenticated actor before listing any candidate", async () => {
    mocks.getCurrentActor.mockRejectedValueOnce(new UnauthorizedError());

    const response = await listCandidatesGET(
      new Request("http://localhost/api/projects/controlled-project/furniture/candidates"),
      { params: Promise.resolve({ projectId: "controlled-project" }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(mocks.listFurnitureCandidates).not.toHaveBeenCalled();
    expect(mocks.setActorContext).not.toHaveBeenCalled();
  });

  it("passes only the authenticated actor and route-scoped project to the list service", async () => {
    const candidates = [{ id: CANDIDATE_ID, status: "NEEDS_REVIEW" }];
    mocks.listFurnitureCandidates.mockResolvedValueOnce(candidates);

    const response = await listCandidatesGET(
      new Request("http://localhost/api/projects/controlled-project/furniture/candidates"),
      { params: Promise.resolve({ projectId: "controlled-project" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(mocks.listFurnitureCandidates).toHaveBeenCalledWith(actor, "controlled-project");
    expect(await response.json()).toEqual({ ok: true, data: candidates });
  });

  it("strictly validates and trims a correction before calling the scoped service", async () => {
    const corrected = { id: CANDIDATE_ID, status: "CORRECTED" };
    mocks.correctFurnitureCandidate.mockResolvedValueOnce(corrected);
    const response = await correctCandidatePATCH(
      request(
        "PATCH",
        `/api/projects/controlled-project/furniture/candidates/${CANDIDATE_ID}`,
        {
          room: "  KITCHEN  ",
          quantity: 2,
          dimensions: { width: 610, height: 720, depth: null, thickness: 18 },
          finish: "  Walnut  ",
          reason: "  Verified against drawing A-401.  ",
        },
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.correctFurnitureCandidate).toHaveBeenCalledWith(actor, "controlled-project", CANDIDATE_ID, {
      room: "KITCHEN",
      quantity: 2,
      dimensions: { width: 610, height: 720, depth: null, thickness: 18 },
      finish: "Walnut",
      reason: "Verified against drawing A-401.",
    });
    expect(await response.json()).toEqual({ ok: true, data: corrected });
  });

  it.each([
    ["invalid candidate id", { projectId: "controlled-project", candidateId: "not-a-uuid" }, { reason: "Valid reason" }],
    ["missing reason", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { quantity: 2 }],
    ["unknown input field", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { reason: "Valid reason", companyId: COMPANY_ID }],
    ["non-positive dimension", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { reason: "Valid reason", dimensions: { width: 0 } }],
  ])("rejects %s before any correction mutation", async (_label, params, body) => {
    const response = await correctCandidatePATCH(
      request("PATCH", "/api/projects/controlled-project/furniture/candidates/value", body),
      { params: Promise.resolve(params) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.correctFurnitureCandidate).not.toHaveBeenCalled();
  });

  it("passes only explicit review acknowledgements to approval", async () => {
    const approved = { id: CANDIDATE_ID, status: "CONFIRMED" };
    mocks.approveFurnitureCandidate.mockResolvedValueOnce(approved);
    const response = await approveCandidatePOST(
      request(
        "POST",
        `/api/projects/controlled-project/furniture/candidates/${CANDIDATE_ID}/approve`,
        { acknowledgedIssueCodes: ["FINISH_REQUIRES_VERIFICATION"] },
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.approveFurnitureCandidate).toHaveBeenCalledWith(
      actor,
      "controlled-project",
      CANDIDATE_ID,
      ["FINISH_REQUIRES_VERIFICATION"],
    );
    expect(await response.json()).toEqual({ ok: true, data: approved });
  });

  it("surfaces service capability denial without mutating", async () => {
    mocks.approveFurnitureCandidate.mockRejectedValueOnce(new PermissionDeniedError());
    const response = await approveCandidatePOST(
      request(
        "POST",
        `/api/projects/controlled-project/furniture/candidates/${CANDIDATE_ID}/approve`,
        {},
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "PERMISSION_DENIED" },
    });
  });

  it("keeps order-item GET authenticated and passes only actor plus route project", async () => {
    mocks.getCurrentActor.mockRejectedValueOnce(new UnauthorizedError());
    const unauthenticated = await listOrderItemsGET(
      new Request("http://localhost/api/projects/controlled-project/furniture/order-items"),
      { params: Promise.resolve({ projectId: "controlled-project" }) },
    );
    expect(unauthenticated.status).toBe(401);
    expect(mocks.listFurnitureOrderItemCandidates).not.toHaveBeenCalled();

    mocks.getCurrentActor.mockResolvedValueOnce(actor);
    const orderItems = [{ id: CANDIDATE_ID, status: "NEEDS_REVIEW", candidate: { category: "HARDWARE" } }];
    mocks.listFurnitureOrderItemCandidates.mockResolvedValueOnce(orderItems);
    const response = await listOrderItemsGET(
      new Request("http://localhost/api/projects/controlled-project/furniture/order-items"),
      { params: Promise.resolve({ projectId: "controlled-project" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(mocks.listFurnitureOrderItemCandidates).toHaveBeenCalledWith(actor, "controlled-project");
    expect(await response.json()).toEqual({ ok: true, data: orderItems });
  });

  it("strictly validates, trims and scopes an order-item correction", async () => {
    const corrected = { id: CANDIDATE_ID, status: "CORRECTED" };
    mocks.correctFurnitureOrderItemCandidate.mockResolvedValueOnce(corrected);
    const response = await correctOrderItemPATCH(
      request(
        "PATCH",
        `/api/projects/controlled-project/furniture/order-items/${CANDIDATE_ID}`,
        {
          description: "  Soft-close concealed hinge  ",
          quantity: 14,
          unit: "  pcs  ",
          category: "HARDWARE",
          suppliedByOthers: false,
          notes: "  Checked against schedule H-07.  ",
          reason: "  Confirmed by professional reviewer.  ",
        },
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.correctFurnitureOrderItemCandidate).toHaveBeenCalledWith(
      actor,
      "controlled-project",
      CANDIDATE_ID,
      {
        description: "Soft-close concealed hinge",
        quantity: 14,
        unit: "pcs",
        category: "HARDWARE",
        suppliedByOthers: false,
        notes: "Checked against schedule H-07.",
        reason: "Confirmed by professional reviewer.",
      },
    );
    expect(await response.json()).toEqual({ ok: true, data: corrected });
  });

  it.each([
    ["invalid order item id", { projectId: "controlled-project", candidateId: "not-a-uuid" }, { reason: "Valid reason" }],
    ["missing correction reason", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { quantity: 2 }],
    ["unknown tenant field", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { reason: "Valid reason", companyId: COMPANY_ID }],
    ["invalid order quantity", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { reason: "Valid reason", quantity: 0 }],
    ["invented category", { projectId: "controlled-project", candidateId: CANDIDATE_ID }, { reason: "Valid reason", category: "MISC" }],
  ])("rejects %s before any order-item correction", async (_label, params, body) => {
    const response = await correctOrderItemPATCH(
      request("PATCH", "/api/projects/controlled-project/furniture/order-items/value", body),
      { params: Promise.resolve(params) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.correctFurnitureOrderItemCandidate).not.toHaveBeenCalled();
  });

  it("passes only explicit order-item acknowledgements and rejects extra body fields", async () => {
    const approved = { id: CANDIDATE_ID, status: "CONFIRMED" };
    mocks.approveFurnitureOrderItemCandidate.mockResolvedValueOnce(approved);
    const response = await approveOrderItemPOST(
      request(
        "POST",
        `/api/projects/controlled-project/furniture/order-items/${CANDIDATE_ID}/approve`,
        { acknowledgedIssueCodes: ["MISSING_UNIT", "CATEGORY_REQUIRES_REVIEW"] },
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.approveFurnitureOrderItemCandidate).toHaveBeenCalledWith(
      actor,
      "controlled-project",
      CANDIDATE_ID,
      ["MISSING_UNIT", "CATEGORY_REQUIRES_REVIEW"],
    );
    expect(await response.json()).toEqual({ ok: true, data: approved });

    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
    const rejected = await approveOrderItemPOST(
      request(
        "POST",
        `/api/projects/controlled-project/furniture/order-items/${CANDIDATE_ID}/approve`,
        { acknowledgedIssueCodes: [], companyId: COMPANY_ID },
      ),
      { params: Promise.resolve({ projectId: "controlled-project", candidateId: CANDIDATE_ID }) },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.approveFurnitureOrderItemCandidate).not.toHaveBeenCalled();
  });
});
