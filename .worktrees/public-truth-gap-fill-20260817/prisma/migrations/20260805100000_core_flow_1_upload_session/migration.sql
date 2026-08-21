-- CORE-FLOW-1: direct-to-Blob large drawing upload session tracking.
-- Additive only. No existing table, column, or row is altered.

-- CreateEnum
CREATE TYPE "ProjectFileUploadSessionStatus" AS ENUM ('PENDING', 'FINALIZED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProjectFileUploadSession" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "declaredMimeType" TEXT NOT NULL,
    "declaredByteSize" INTEGER NOT NULL,
    "extension" TEXT NOT NULL,
    "status" "ProjectFileUploadSessionStatus" NOT NULL DEFAULT 'PENDING',
    "finalizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFileUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFileUploadSession_storageKey_key" ON "ProjectFileUploadSession"("storageKey");

-- CreateIndex
CREATE INDEX "ProjectFileUploadSession_companyId_idx" ON "ProjectFileUploadSession"("companyId");

-- CreateIndex
CREATE INDEX "ProjectFileUploadSession_projectId_idx" ON "ProjectFileUploadSession"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFileUploadSession_expiresAt_idx" ON "ProjectFileUploadSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectFileUploadSession_status_idx" ON "ProjectFileUploadSession"("status");

-- AddForeignKey
ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
