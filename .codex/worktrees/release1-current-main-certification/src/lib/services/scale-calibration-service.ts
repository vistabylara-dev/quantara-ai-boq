import { ScaleCalibrationType } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { getDrawingPageRecord } from "@/lib/repositories/drawing-page-repository";
import { createCalibration, getLatestCalibration, toScaleCalibrationDTO } from "@/lib/repositories/scale-calibration-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type SetScaleInput = {
  scaleRatio: number;
  drawingUnit: string;
  realWorldUnit: string;
};

/** Manual scale entry — always human-confirmed, so isVerified is true immediately (spec section 15: a detected scale is only ever a suggestion; this path is the human-confirmed one). */
export async function setManualScale(actor: CurrentActor, pageId: string, input: SetScaleInput) {
  requireCapability(actor, "files:manage");
  const page = await getDrawingPageRecord(actor.companyId, pageId);

  if (!(input.scaleRatio > 0)) {
    throw new AppError("INVALID_SCALE_RATIO", "scaleRatio must be a positive number.", 400);
  }

  const created = await createCalibration(actor.companyId, {
    drawingPageId: page.id,
    calibrationType: ScaleCalibrationType.MANUAL_INPUT,
    scaleRatio: input.scaleRatio,
    drawingUnit: input.drawingUnit,
    realWorldUnit: input.realWorldUnit,
    isVerified: true,
    verifiedByUserId: actor.userId,
  });

  await createAuditLog(actor.companyId, { entityType: "DrawingPage", entityId: pageId, action: "SCALE_CALIBRATED", payload: { scaleRatio: input.scaleRatio, drawingUnit: input.drawingUnit, realWorldUnit: input.realWorldUnit } });
  return toScaleCalibrationDTO(created);
}

export async function getPageScale(actor: CurrentActor, pageId: string) {
  await getDrawingPageRecord(actor.companyId, pageId);
  const latest = await getLatestCalibration(actor.companyId, pageId);
  return latest ? toScaleCalibrationDTO(latest) : null;
}

/** Gate used by future sub-phases (quantity calculation) — spec section 15: "spatial quantities blocked without verified scale." */
export async function assertPageScaleVerified(companyId: string, drawingPageId: string): Promise<void> {
  const latest = await getLatestCalibration(companyId, drawingPageId);
  if (!latest || !latest.isVerified) {
    throw new AppError("SCALE_NOT_VERIFIED", "This page has no verified scale calibration. Spatial quantities cannot be calculated until the scale is confirmed.", 409);
  }
}
