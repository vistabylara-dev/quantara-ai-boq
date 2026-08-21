-- AlterTable
ALTER TABLE "BOQ" ADD COLUMN     "lockedByUserId" UUID;

-- AddForeignKey
ALTER TABLE "BOQ" ADD CONSTRAINT "BOQ_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
