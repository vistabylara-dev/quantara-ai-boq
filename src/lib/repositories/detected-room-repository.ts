import type { DetectedRoom, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export function toDetectedRoomDTO(room: DetectedRoom) {
  return {
    id: room.id,
    projectId: room.projectId,
    drawingPageId: room.drawingPageId,
    roomName: room.roomName,
    roomNumber: room.roomNumber,
    boundaryGeometry: room.boundaryGeometryJson,
    area: room.area?.toNumber() ?? null,
    perimeter: room.perimeter?.toNumber() ?? null,
    ceilingHeight: room.ceilingHeight?.toNumber() ?? null,
    floorLevel: room.floorLevel,
    scaleCalibrationId: room.scaleCalibrationId,
    confidence: room.confidence.toNumber(),
    status: room.status,
    correction: room.correctedDataJson,
    confirmedByUserId: room.confirmedByUserId,
    confirmedAt: room.confirmedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function getDetectedRoomRecord(companyId: string, roomId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const room = await tx.detectedRoom.findFirst({ where: { id: roomId, companyId } });
  if (!room) throw new NotFoundError("Detected room not found.");
  return room;
}

export async function listDetectedRooms(companyId: string, projectId: string) {
  return prisma.detectedRoom.findMany({
    where: { companyId, projectId },
    orderBy: [{ floorLevel: "asc" }, { roomNumber: "asc" }, { roomName: "asc" }],
  });
}
