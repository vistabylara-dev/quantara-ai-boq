import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  setActorContext: vi.fn(),
  createManualDetectedRoom: vi.fn(),
  listRoomsForProject: vi.fn(),
  confirmDetectedRoom: vi.fn(),
  correctDetectedRoom: vi.fn(),
  rejectDetectedRoom: vi.fn(),
}));

vi.mock("@/lib/auth/current-actor", () => ({ getCurrentActor: mocks.getCurrentActor }));
vi.mock("@/lib/auth/request-context", () => ({
  setActorContext: mocks.setActorContext,
  withActorRequestContext: <T extends (...args: never[]) => unknown>(handler: T) => handler,
}));
vi.mock("@/lib/services/detected-room-service", () => ({
  createManualDetectedRoom: mocks.createManualDetectedRoom,
  listRoomsForProject: mocks.listRoomsForProject,
  confirmDetectedRoom: mocks.confirmDetectedRoom,
  correctDetectedRoom: mocks.correctDetectedRoom,
  rejectDetectedRoom: mocks.rejectDetectedRoom,
}));

import { GET as listRoomsGET, POST as createRoomPOST } from "../src/app/api/projects/[projectId]/rooms/route";
import { POST as confirmRoomPOST } from "../src/app/api/rooms/[roomId]/confirm/route";
import { POST as correctRoomPOST } from "../src/app/api/rooms/[roomId]/correct/route";
import { POST as rejectRoomPOST } from "../src/app/api/rooms/[roomId]/reject/route";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";
const PAGE_ID = "44444444-4444-4444-8444-444444444444";

const actor = {
  userId: USER_ID,
  companyId: COMPANY_ID,
  role: UserRole.COMPANY_OWNER,
  fullName: "Room Reviewer",
  email: "room-reviewer@example.com",
};

function postRequest(path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Detected room API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentActor.mockResolvedValue(actor);
  });

  it("lists tenant-scoped rooms using the caller's project identifier", async () => {
    const rooms = [{ id: ROOM_ID, status: "NEEDS_REVIEW" }];
    mocks.listRoomsForProject.mockResolvedValue(rooms);
    const response = await listRoomsGET(
      new Request("http://localhost/api/projects/project-0001/rooms"),
      { params: Promise.resolve({ projectId: "project-0001" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.setActorContext).toHaveBeenCalledWith(actor);
    expect(mocks.listRoomsForProject).toHaveBeenCalledWith(actor, "project-0001");
    expect(await response.json()).toEqual({ ok: true, data: rooms });
  });

  it("creates only an explicitly manual, positive-measurement room payload", async () => {
    const room = { id: ROOM_ID, status: "NEEDS_REVIEW" };
    mocks.createManualDetectedRoom.mockResolvedValue(room);
    const response = await createRoomPOST(
      postRequest("/api/projects/project-0001/rooms", {
        drawingPageId: PAGE_ID,
        roomName: "  Meeting Room  ",
        roomNumber: "  L1-04  ",
        area: 24.5,
        perimeter: 20,
        ceilingHeight: 3.1,
      }),
      { params: Promise.resolve({ projectId: "project-0001" }) },
    );
    expect(response.status).toBe(201);
    expect(mocks.createManualDetectedRoom).toHaveBeenCalledWith(actor, "project-0001", {
      drawingPageId: PAGE_ID,
      roomName: "Meeting Room",
      roomNumber: "L1-04",
      area: 24.5,
      perimeter: 20,
      ceilingHeight: 3.1,
    });
  });

  it.each([0, -1])("rejects a non-positive room area (%s) before service mutation", async (area) => {
    const response = await createRoomPOST(
      postRequest("/api/projects/project-0001/rooms", { roomName: "Invalid Room", area }),
      { params: Promise.resolve({ projectId: "project-0001" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.createManualDetectedRoom).not.toHaveBeenCalled();
  });

  it("confirms a room without accepting client-supplied confirmation identity", async () => {
    mocks.confirmDetectedRoom.mockResolvedValue({ id: ROOM_ID, status: "CONFIRMED" });
    const response = await confirmRoomPOST(postRequest(`/api/rooms/${ROOM_ID}/confirm`), {
      params: Promise.resolve({ roomId: ROOM_ID }),
    });
    expect(response.status).toBe(200);
    expect(mocks.confirmDetectedRoom).toHaveBeenCalledWith(actor, ROOM_ID);
  });

  it("requires and trims a professional correction reason", async () => {
    mocks.correctDetectedRoom.mockResolvedValue({ id: ROOM_ID, status: "CORRECTED" });
    const response = await correctRoomPOST(
      postRequest(`/api/rooms/${ROOM_ID}/correct`, { area: 25, reason: "  Checked against A-101.  " }),
      { params: Promise.resolve({ roomId: ROOM_ID }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.correctDetectedRoom).toHaveBeenCalledWith(actor, ROOM_ID, { area: 25, reason: "Checked against A-101." });
  });

  it("requires and trims a professional rejection reason", async () => {
    mocks.rejectDetectedRoom.mockResolvedValue({ id: ROOM_ID, status: "REJECTED" });
    const response = await rejectRoomPOST(
      postRequest(`/api/rooms/${ROOM_ID}/reject`, { reason: "  Boundary is not supported by the drawing.  " }),
      { params: Promise.resolve({ roomId: ROOM_ID }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.rejectDetectedRoom).toHaveBeenCalledWith(actor, ROOM_ID, "Boundary is not supported by the drawing.");
  });
});
