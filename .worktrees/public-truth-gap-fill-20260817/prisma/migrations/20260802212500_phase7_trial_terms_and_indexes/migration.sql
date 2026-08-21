-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "trialTermsAcceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_name_idx" ON "CompanyLibraryItem"("name");

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_lastUsedAt_idx" ON "CompanyLibraryItem"("lastUsedAt");

-- CreateIndex
CREATE INDEX "MasterItem_name_idx" ON "MasterItem"("name");

