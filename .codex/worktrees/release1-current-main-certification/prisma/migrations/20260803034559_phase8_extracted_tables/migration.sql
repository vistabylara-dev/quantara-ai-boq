-- CreateEnum
CREATE TYPE "ExtractedTableType" AS ENUM ('SUPPLIER_QUOTATION', 'EXISTING_BOQ', 'FURNITURE_SCHEDULE', 'EQUIPMENT_SCHEDULE', 'STRUCTURAL_QUANTITY_SCHEDULE', 'DOOR_SCHEDULE', 'WINDOW_SCHEDULE', 'FINISH_SCHEDULE', 'MATERIAL_SCHEDULE', 'GENERIC_TABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExtractedTableStatus" AS ENUM ('EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'CORRECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExtractedTable" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectFileId" UUID NOT NULL,
    "drawingPageId" UUID,
    "sheetName" TEXT,
    "title" TEXT,
    "tableType" "ExtractedTableType" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DECIMAL(5,2) NOT NULL,
    "boundingGeometryJson" JSONB,
    "sourceReference" TEXT,
    "status" "ExtractedTableStatus" NOT NULL DEFAULT 'EXTRACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedTableRow" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "extractedTableId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "parentRowId" UUID,
    "normalizedDataJson" JSONB,
    "rawDataJson" JSONB,
    "confidence" DECIMAL(5,2) NOT NULL,
    "status" "ExtractedTableStatus" NOT NULL DEFAULT 'EXTRACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedTableCell" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "extractedTableRowId" UUID NOT NULL,
    "columnKey" TEXT NOT NULL,
    "rawValue" TEXT,
    "normalizedValue" TEXT,
    "confidence" DECIMAL(5,2) NOT NULL,
    "sourceCellReference" TEXT,
    "boundingGeometryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedTableCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractedTable_companyId_idx" ON "ExtractedTable"("companyId");

-- CreateIndex
CREATE INDEX "ExtractedTable_projectFileId_idx" ON "ExtractedTable"("projectFileId");

-- CreateIndex
CREATE INDEX "ExtractedTable_status_idx" ON "ExtractedTable"("status");

-- CreateIndex
CREATE INDEX "ExtractedTable_tableType_idx" ON "ExtractedTable"("tableType");

-- CreateIndex
CREATE INDEX "ExtractedTableRow_companyId_idx" ON "ExtractedTableRow"("companyId");

-- CreateIndex
CREATE INDEX "ExtractedTableRow_extractedTableId_idx" ON "ExtractedTableRow"("extractedTableId");

-- CreateIndex
CREATE INDEX "ExtractedTableRow_parentRowId_idx" ON "ExtractedTableRow"("parentRowId");

-- CreateIndex
CREATE INDEX "ExtractedTableRow_status_idx" ON "ExtractedTableRow"("status");

-- CreateIndex
CREATE INDEX "ExtractedTableCell_companyId_idx" ON "ExtractedTableCell"("companyId");

-- CreateIndex
CREATE INDEX "ExtractedTableCell_extractedTableRowId_idx" ON "ExtractedTableCell"("extractedTableRowId");

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTableRow" ADD CONSTRAINT "ExtractedTableRow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTableRow" ADD CONSTRAINT "ExtractedTableRow_extractedTableId_fkey" FOREIGN KEY ("extractedTableId") REFERENCES "ExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTableRow" ADD CONSTRAINT "ExtractedTableRow_parentRowId_fkey" FOREIGN KEY ("parentRowId") REFERENCES "ExtractedTableRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTableCell" ADD CONSTRAINT "ExtractedTableCell_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTableCell" ADD CONSTRAINT "ExtractedTableCell_extractedTableRowId_fkey" FOREIGN KEY ("extractedTableRowId") REFERENCES "ExtractedTableRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

