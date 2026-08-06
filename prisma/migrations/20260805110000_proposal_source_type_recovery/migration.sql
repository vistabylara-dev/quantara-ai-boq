-- PROPOSAL-SOURCE-TYPE-RECOVERY
-- Adds a typed, discriminated proposal source (BOQ_REVISION | TECHNICAL_REPORT_REVISION) to
-- ClientProposal. Additive only: boqId/revisionNumber become nullable but every existing row
-- keeps its current value, and sourceType defaults to BOQ_REVISION so all pre-existing proposals
-- are correctly classified without any data loss or rewrite.

-- 1. New enum
CREATE TYPE "ClientProposalSourceType" AS ENUM ('BOQ_REVISION', 'TECHNICAL_REPORT_REVISION');

-- 2. New columns: sourceType (defaulted for existing rows), technicalReportId (nullable)
ALTER TABLE "ClientProposal"
  ADD COLUMN "sourceType" "ClientProposalSourceType" NOT NULL DEFAULT 'BOQ_REVISION',
  ADD COLUMN "technicalReportId" UUID;

-- 3. boqId/revisionNumber become optional so a technical-report proposal can leave them null
ALTER TABLE "ClientProposal"
  ALTER COLUMN "boqId" DROP NOT NULL,
  ALTER COLUMN "revisionNumber" DROP NOT NULL;

-- 4. FK + index for the new technical-report source reference (mirrors the existing boqId FK)
ALTER TABLE "ClientProposal"
  ADD CONSTRAINT "ClientProposal_technicalReportId_fkey"
  FOREIGN KEY ("technicalReportId") REFERENCES "GeneratedTechnicalReport"(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "ClientProposal_technicalReportId_idx" ON "ClientProposal"("technicalReportId");

-- 5. Guarantee exactly one valid source is ever set, and that it matches sourceType — the DB-level
-- backstop behind the service-layer validation (never both a boqId and a technicalReportId).
ALTER TABLE "ClientProposal"
  ADD CONSTRAINT "ClientProposal_source_consistency_check" CHECK (
    ("sourceType" = 'BOQ_REVISION' AND "boqId" IS NOT NULL AND "revisionNumber" IS NOT NULL AND "technicalReportId" IS NULL)
    OR
    ("sourceType" = 'TECHNICAL_REPORT_REVISION' AND "technicalReportId" IS NOT NULL AND "boqId" IS NULL AND "revisionNumber" IS NULL)
  );
