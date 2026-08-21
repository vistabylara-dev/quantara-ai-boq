-- CreateTable
CREATE TABLE "DrawingPage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectFileId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "sheetName" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "dpi" INTEGER,
    "imageStorageKey" TEXT,
    "thumbnailStorageKey" TEXT,
    "vectorDataStorageKey" TEXT,
    "textLayerJson" JSONB,
    "titleBlockJson" JSONB,
    "detectedScale" TEXT,
    "scaleUnit" TEXT,
    "scaleConfidence" DECIMAL(5,2),
    "orientation" TEXT,
    "cropBoxJson" JSONB,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingLayer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "drawingPageId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "layerType" TEXT,
    "sourceLayerName" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingLayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawingPage_companyId_idx" ON "DrawingPage"("companyId");

-- CreateIndex
CREATE INDEX "DrawingPage_projectFileId_idx" ON "DrawingPage"("projectFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingPage_projectFileId_pageNumber_key" ON "DrawingPage"("projectFileId", "pageNumber");

-- CreateIndex
CREATE INDEX "DrawingLayer_companyId_idx" ON "DrawingLayer"("companyId");

-- CreateIndex
CREATE INDEX "DrawingLayer_drawingPageId_idx" ON "DrawingLayer"("drawingPageId");

-- AddForeignKey
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLayer" ADD CONSTRAINT "DrawingLayer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLayer" ADD CONSTRAINT "DrawingLayer_drawingPageId_fkey" FOREIGN KEY ("drawingPageId") REFERENCES "DrawingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

