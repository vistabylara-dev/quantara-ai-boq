-- AlterTable
ALTER TABLE "BOQ" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedVersion" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
