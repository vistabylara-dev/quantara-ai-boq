-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "taxRegistrationNumber" TEXT;

-- CreateIndex
CREATE INDEX "Client_isArchived_idx" ON "Client"("isArchived");
