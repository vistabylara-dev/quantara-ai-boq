import type { DrawingScaleCalibration } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export function toScaleCalibrationDTO(row: DrawingScaleCalibration) {
  return {
    id: row.id,
    drawingPageId: row.drawingPageId,
    calibrationType: row.calibrationType,
    scaleRatio: row.scaleRatio.toNumber(),
    drawingUnit: row.drawingUnit,
    realWorldUnit: row.realWorldUnit,
    sourceText: row.sourceText,
    confidence: row.confidence?.toNumber() ?? null,
    isVerified: row.isVerified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The most recent calibration for a page — later calibrations supersede earlier ones (spec: "conflicting scales require review", handled by simply always trusting the latest explicit input). */
export async function getLatestCalibration(companyId: string, drawingPageId: string): Promise<DrawingScaleCalibration | null> {
  return prisma.drawingScaleCalibration.findFirst({ where: { companyId, drawingPageId }, orderBy: { createdAt: "desc" } });
}

export async function isPageScaleVerified(companyId: string, drawingPageId: string): Promise<boolean> {
  const latest = await getLatestCalibration(companyId, drawingPageId);
  return latest?.isVerified === true;
}

export type CreateCalibrationInput = {
  drawingPageId: string;
  calibrationType: DrawingScaleCalibration["calibrationType"];
  scaleRatio: number;
  drawingUnit: string;
  realWorldUnit: string;
  sourceText?: string;
  confidence?: number;
  /** Manual input from a human is verified immediately; a detected/suggested scale starts unverified. */
  isVerified: boolean;
  verifiedByUserId?: string;
};

export async function createCalibration(companyId: string, input: CreateCalibrationInput): Promise<DrawingScaleCalibration> {
  return prisma.drawingScaleCalibration.create({
    data: {
      companyId,
      drawingPageId: input.drawingPageId,
      calibrationType: input.calibrationType,
      scaleRatio: input.scaleRatio,
      drawingUnit: input.drawingUnit,
      realWorldUnit: input.realWorldUnit,
      sourceText: input.sourceText,
      confidence: input.confidence,
      isVerified: input.isVerified,
      verifiedByUserId: input.isVerified ? input.verifiedByUserId : undefined,
      verifiedAt: input.isVerified ? new Date() : undefined,
    },
  });
}
