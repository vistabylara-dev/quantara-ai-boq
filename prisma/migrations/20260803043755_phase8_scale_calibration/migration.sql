-- CreateEnum
CREATE TYPE "ScaleCalibrationType" AS ENUM ('DETECTED_SCALE_TEXT', 'KNOWN_DIMENSION', 'TWO_POINT', 'VECTOR_UNIT', 'MANUAL_INPUT');

-- CreateTable
CREATE TABLE "DrawingScaleCalibration" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "drawingPageId" UUID NOT NULL,
    "calibrationType" "ScaleCalibrationType" NOT NULL,
    "scaleRatio" DECIMAL(14,6) NOT NULL,
    "drawingUnit" TEXT NOT NULL,
    "realWorldUnit" TEXT NOT NULL,
    "sourceText" TEXT,
    "sourceGeometryJson" JSONB,
    "confidence" DECIMAL(5,2),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByUserId" UUID,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingScaleCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawingScaleCalibration_companyId_idx" ON "DrawingScaleCalibration"("companyId");

-- CreateIndex
CREATE INDEX "DrawingScaleCalibration_drawingPageId_idx" ON "DrawingScaleCalibration"("drawingPageId");

-- AddForeignKey
ALTER TABLE "DrawingScaleCalibration" ADD CONSTRAINT "DrawingScaleCalibration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingScaleCalibration" ADD CONSTRAINT "DrawingScaleCalibration_drawingPageId_fkey" FOREIGN KEY ("drawingPageId") REFERENCES "DrawingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

