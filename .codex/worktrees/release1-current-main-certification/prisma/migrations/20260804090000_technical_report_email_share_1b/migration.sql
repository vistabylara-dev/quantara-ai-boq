-- Technical Report Email Service 1B
-- Additive only: no existing column is altered or dropped, no existing row is touched.

-- Client-facing secure share link for a generated technical report (mirrors
-- ClientProposal.tokenHash — see prisma/schema.prisma comment on GeneratedTechnicalReport).
ALTER TABLE "GeneratedTechnicalReport" ADD COLUMN "shareTokenHash" TEXT;
ALTER TABLE "GeneratedTechnicalReport" ADD COLUMN "shareExpiresAt" TIMESTAMP(3);
ALTER TABLE "GeneratedTechnicalReport" ADD COLUMN "shareRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "GeneratedTechnicalReport_shareTokenHash_key" ON "GeneratedTechnicalReport"("shareTokenHash");

-- Let EmailDispatch log/audit technical-report sends through the same table as proposal emails.
ALTER TABLE "EmailDispatch" ADD COLUMN "generatedTechnicalReportId" UUID;

CREATE INDEX "EmailDispatch_generatedTechnicalReportId_idx" ON "EmailDispatch"("generatedTechnicalReportId");

ALTER TABLE "EmailDispatch"
  ADD CONSTRAINT "EmailDispatch_generatedTechnicalReportId_fkey"
  FOREIGN KEY ("generatedTechnicalReportId") REFERENCES "GeneratedTechnicalReport"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
