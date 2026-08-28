import type { DetectedRoom, ExtractedEntityStatus, Prisma } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getDetectedRoomRecord, listDetectedRooms, toDetectedRoomDTO } from "@/lib/repositories/detected-room-repository";
import { getDrawingPageRecord } from "@/lib/repositories/drawing-page-repository";
import { getProjectFileRecord } from "@/lib/repositories/project-file-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import type { CorrectDetectedRoomInput, CreateDetectedRoomInput } from "@/lib/validation/detected-room-schema";

const REVIEWABLE_ROOM_STATUSES: ReadonlySet<ExtractedEntityStatus> = new Set(["EXTRACTED", "NEEDS_REVIEW"]);

function assertRoomIsReviewable(status: ExtractedEntityStatus) {
  if (!REVIEWABLE_ROOM_STATUSES.has(status)) {
    throw new AppError("ROOM_ALREADY_FINALIZED", "This room has already received a professional decision.", 409);
  }
}

async function assertDrawingEvidenceBelongsToProject(
  companyId: string,
  projectId: string,
  drawingPageId?: string | null,
  scaleCalibrationId?: string | null,
) {
  if (!drawingPageId && scaleCalibrationId) {
    throw new AppError("ROOM_SCALE_PAGE_REQUIRED", "A scale calibration can only be linked with its drawing page.", 400);
  }
  if (!drawingPageId) return;

  const page = await getDrawingPageRecord(companyId, drawingPageId);
  const file = await getProjectFileRecord(companyId, page.projectFileId);
  if (file.projectId !== projectId) {
    throw new AppError("ROOM_PAGE_PROJECT_MISMATCH", "This drawing page does not belong to the specified project.", 400);
  }

  if (scaleCalibrationId) {
    const calibration = await prisma.drawingScaleCalibration.findFirst({
      where: { id: scaleCalibrationId, companyId, drawingPageId },
      select: { id: true, isVerified: true },
    });
    if (!calibration) {
      throw new AppError("ROOM_SCALE_PAGE_MISMATCH", "This scale calibration does not belong to the selected drawing page.", 400);
    }
    if (!calibration.isVerified) {
      throw new AppError("ROOM_SCALE_NOT_VERIFIED", "Room measurements cannot use an unverified drawing scale.", 409);
    }
  }
}

export async function createManualDetectedRoom(actor: CurrentActor, projectId: string, input: CreateDetectedRoomInput) {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, projectId);
  await assertDrawingEvidenceBelongsToProject(actor.companyId, project.id, input.drawingPageId, input.scaleCalibrationId);

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.detectedRoom.create({
      data: {
        companyId: actor.companyId,
        projectId: project.id,
        drawingPageId: input.drawingPageId ?? null,
        roomName: input.roomName,
        roomNumber: input.roomNumber ?? null,
        boundaryGeometryJson: input.boundaryGeometry as Prisma.InputJsonValue | undefined,
        area: input.area ?? null,
        perimeter: input.perimeter ?? null,
        ceilingHeight: input.ceilingHeight ?? null,
        floorLevel: input.floorLevel ?? null,
        scaleCalibrationId: input.scaleCalibrationId ?? null,
        confidence: 100,
        status: "NEEDS_REVIEW",
      },
    });
    await createAuditLog(actor.companyId, {
      entityType: "DetectedRoom",
      entityId: created.id,
      action: "ROOM_MANUALLY_ADDED",
      payload: { projectId: project.id, drawingPageId: created.drawingPageId, roomName: created.roomName },
    }, tx);
    return created;
  });
  return toDetectedRoomDTO(room);
}

export async function listRoomsForProject(actor: CurrentActor, projectId: string) {
  const project = await getProjectRecord(actor.companyId, projectId);
  return (await listDetectedRooms(actor.companyId, project.id)).map(toDetectedRoomDTO);
}

async function claimRoomDecision(
  tx: Prisma.TransactionClient,
  actor: CurrentActor,
  room: DetectedRoom,
  data: Prisma.DetectedRoomUpdateManyMutationInput,
) {
  assertRoomIsReviewable(room.status);
  const claimed = await tx.detectedRoom.updateMany({
    where: { id: room.id, companyId: actor.companyId, status: { in: [...REVIEWABLE_ROOM_STATUSES] } },
    data,
  });
  if (claimed.count !== 1) {
    const current = await getDetectedRoomRecord(actor.companyId, room.id, tx);
    assertRoomIsReviewable(current.status);
    throw new AppError("ROOM_REVIEW_CONFLICT", "This room could not be claimed for professional review.", 409);
  }
  return getDetectedRoomRecord(actor.companyId, room.id, tx);
}

export async function confirmDetectedRoom(actor: CurrentActor, roomId: string) {
  requireCapability(actor, "verification:manage");
  const room = await prisma.$transaction(async (tx) => {
    const current = await getDetectedRoomRecord(actor.companyId, roomId, tx);
    const updated = await claimRoomDecision(tx, actor, current, {
      status: "CONFIRMED",
      confirmedByUserId: actor.userId,
      confirmedAt: new Date(),
    });
    await createAuditLog(actor.companyId, { entityType: "DetectedRoom", entityId: roomId, action: "ROOM_CONFIRMED", payload: {} }, tx);
    return updated;
  });
  return toDetectedRoomDTO(room);
}

export async function correctDetectedRoom(actor: CurrentActor, roomId: string, corrections: CorrectDetectedRoomInput) {
  requireCapability(actor, "verification:manage");
  const current = await getDetectedRoomRecord(actor.companyId, roomId);
  await assertDrawingEvidenceBelongsToProject(
    actor.companyId,
    current.projectId,
    corrections.drawingPageId === undefined ? current.drawingPageId : corrections.drawingPageId,
    corrections.scaleCalibrationId === undefined ? current.scaleCalibrationId : corrections.scaleCalibrationId,
  );

  const room = await prisma.$transaction(async (tx) => {
    const fresh = await getDetectedRoomRecord(actor.companyId, roomId, tx);
    const original = toDetectedRoomDTO(fresh);
    const updated = await claimRoomDecision(tx, actor, fresh, {
      drawingPageId: corrections.drawingPageId === undefined ? fresh.drawingPageId : corrections.drawingPageId,
      roomName: corrections.roomName ?? fresh.roomName,
      roomNumber: corrections.roomNumber === undefined ? fresh.roomNumber : corrections.roomNumber,
      boundaryGeometryJson: corrections.boundaryGeometry === undefined
        ? fresh.boundaryGeometryJson ?? undefined
        : corrections.boundaryGeometry as Prisma.InputJsonValue,
      area: corrections.area === undefined ? fresh.area : corrections.area,
      perimeter: corrections.perimeter === undefined ? fresh.perimeter : corrections.perimeter,
      ceilingHeight: corrections.ceilingHeight === undefined ? fresh.ceilingHeight : corrections.ceilingHeight,
      floorLevel: corrections.floorLevel === undefined ? fresh.floorLevel : corrections.floorLevel,
      scaleCalibrationId: corrections.scaleCalibrationId === undefined ? fresh.scaleCalibrationId : corrections.scaleCalibrationId,
      status: "CORRECTED",
      confirmedByUserId: actor.userId,
      confirmedAt: new Date(),
      correctedDataJson: {
        original,
        corrected: corrections,
        reason: corrections.reason,
        correctedByUserId: actor.userId,
        correctedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    });
    await createAuditLog(actor.companyId, {
      entityType: "DetectedRoom",
      entityId: roomId,
      action: "ROOM_CORRECTED",
      payload: { reason: corrections.reason },
    }, tx);
    return updated;
  });
  return toDetectedRoomDTO(room);
}

export async function rejectDetectedRoom(actor: CurrentActor, roomId: string, reason: string) {
  requireCapability(actor, "verification:manage");
  const room = await prisma.$transaction(async (tx) => {
    const current = await getDetectedRoomRecord(actor.companyId, roomId, tx);
    const updated = await claimRoomDecision(tx, actor, current, {
      status: "REJECTED",
      correctedDataJson: { reason, rejectedByUserId: actor.userId, rejectedAt: new Date().toISOString() },
    });
    await createAuditLog(actor.companyId, { entityType: "DetectedRoom", entityId: roomId, action: "ROOM_REJECTED", payload: { reason } }, tx);
    return updated;
  });
  return toDetectedRoomDTO(room);
}
