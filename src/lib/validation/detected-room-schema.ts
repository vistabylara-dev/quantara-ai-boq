import { z } from "zod";

const optionalPositiveMeasurement = z.number().finite().positive().optional().nullable();

export const createDetectedRoomSchema = z.object({
  drawingPageId: z.string().uuid().optional().nullable(),
  roomName: z.string().trim().min(1).max(200),
  roomNumber: z.string().trim().min(1).max(100).optional().nullable(),
  boundaryGeometry: z.record(z.unknown()).optional(),
  area: optionalPositiveMeasurement,
  perimeter: optionalPositiveMeasurement,
  ceilingHeight: optionalPositiveMeasurement,
  floorLevel: z.string().trim().min(1).max(100).optional().nullable(),
  scaleCalibrationId: z.string().uuid().optional().nullable(),
}).strict();

export const correctDetectedRoomSchema = createDetectedRoomSchema.partial().extend({
  reason: z.string().trim().min(1).max(500),
}).strict();

export const rejectDetectedRoomSchema = z.object({
  reason: z.string().trim().min(1).max(500),
}).strict();

export type CreateDetectedRoomInput = z.infer<typeof createDetectedRoomSchema>;
export type CorrectDetectedRoomInput = z.infer<typeof correctDetectedRoomSchema>;
