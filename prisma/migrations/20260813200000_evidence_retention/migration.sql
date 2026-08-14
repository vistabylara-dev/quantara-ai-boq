-- Evidence Safety Phase 2
--
-- Archival and completion now create relational retention locks. These rows
-- make destructive deletion fail at the database boundary while leaving
-- explicit tenant/company data-retention policy outside this migration.

CREATE TABLE "ProjectFileArchive" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "projectFileId" UUID NOT NULL,
  "archivedByUserId" UUID,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectFileArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectFileArchive_projectFileId_key"
  ON "ProjectFileArchive"("projectFileId");
CREATE INDEX "ProjectFileArchive_companyId_idx"
  ON "ProjectFileArchive"("companyId");
CREATE INDEX "ProjectFileArchive_archivedAt_idx"
  ON "ProjectFileArchive"("archivedAt");

ALTER TABLE "ProjectFileArchive"
  ADD CONSTRAINT "ProjectFileArchive_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFileArchive"
  ADD CONSTRAINT "ProjectFileArchive_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectFileArchive"
  ADD CONSTRAINT "ProjectFileArchive_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProjectFileArchive" (
  "id", "companyId", "projectFileId", "archivedByUserId", "archivedAt"
)
SELECT "id", "companyId", "id", NULL, "updatedAt"
FROM "ProjectFile"
WHERE "status" = 'ARCHIVED';

CREATE TABLE "TechnicalReportRetention" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "generatedTechnicalReportId" UUID NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'COMPLETED',
  "protectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalReportRetention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechnicalReportRetention_generatedTechnicalReportId_key"
  ON "TechnicalReportRetention"("generatedTechnicalReportId");
CREATE INDEX "TechnicalReportRetention_companyId_idx"
  ON "TechnicalReportRetention"("companyId");
CREATE INDEX "TechnicalReportRetention_protectedAt_idx"
  ON "TechnicalReportRetention"("protectedAt");

ALTER TABLE "TechnicalReportRetention"
  ADD CONSTRAINT "TechnicalReportRetention_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalReportRetention"
  ADD CONSTRAINT "TechnicalReportRetention_generatedTechnicalReportId_fkey"
  FOREIGN KEY ("generatedTechnicalReportId") REFERENCES "GeneratedTechnicalReport"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TechnicalReportRetention" (
  "id", "companyId", "generatedTechnicalReportId", "reason", "protectedAt"
)
SELECT "id", "companyId", "id", 'COMPLETED', COALESCE("completedAt", "updatedAt")
FROM "GeneratedTechnicalReport"
WHERE "status" = 'COMPLETED';

-- A project source and its reviewed descendants are archived, never erased.
ALTER TABLE "ProjectFile" DROP CONSTRAINT "ProjectFile_projectId_fkey";
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExtractionJob" DROP CONSTRAINT "ExtractionJob_projectFileId_fkey";
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TablePageResolution" DROP CONSTRAINT "TablePageResolution_projectFileId_fkey";
ALTER TABLE "TablePageResolution" ADD CONSTRAINT "TablePageResolution_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExtractedTable" DROP CONSTRAINT "ExtractedTable_projectFileId_fkey";
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DrawingPage" DROP CONSTRAINT "DrawingPage_projectFileId_fkey";
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExtractedEntity" DROP CONSTRAINT "ExtractedEntity_projectFileId_fkey";
ALTER TABLE "ExtractedEntity" ADD CONSTRAINT "ExtractedEntity_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Generated outputs and proposal evidence cannot disappear through a parent cascade.
ALTER TABLE "GeneratedDocument" DROP CONSTRAINT "GeneratedDocument_projectId_fkey";
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument" DROP CONSTRAINT "GeneratedDocument_boqId_fkey";
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_boqId_fkey"
  FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedTechnicalReport" DROP CONSTRAINT "GeneratedTechnicalReport_projectId_fkey";
ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposal" DROP CONSTRAINT "ClientProposal_projectId_fkey";
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposal" DROP CONSTRAINT "ClientProposal_boqId_fkey";
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_boqId_fkey"
  FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposal" DROP CONSTRAINT "ClientProposal_technicalReportId_fkey";
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_technicalReportId_fkey"
  FOREIGN KEY ("technicalReportId") REFERENCES "GeneratedTechnicalReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposalDocument" DROP CONSTRAINT "ClientProposalDocument_generatedDocumentId_fkey";
ALTER TABLE "ClientProposalDocument" ADD CONSTRAINT "ClientProposalDocument_generatedDocumentId_fkey"
  FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposalDocument" DROP CONSTRAINT "ClientProposalDocument_clientProposalId_fkey";
ALTER TABLE "ClientProposalDocument" ADD CONSTRAINT "ClientProposalDocument_clientProposalId_fkey"
  FOREIGN KEY ("clientProposalId") REFERENCES "ClientProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientProposalEvent" DROP CONSTRAINT "ClientProposalEvent_clientProposalId_fkey";
ALTER TABLE "ClientProposalEvent" ADD CONSTRAINT "ClientProposalEvent_clientProposalId_fkey"
  FOREIGN KEY ("clientProposalId") REFERENCES "ClientProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailDispatch" DROP CONSTRAINT "EmailDispatch_generatedTechnicalReportId_fkey";
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_generatedTechnicalReportId_fkey"
  FOREIGN KEY ("generatedTechnicalReportId") REFERENCES "GeneratedTechnicalReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing extraction jobs must already agree with their source file's tenant
-- and project. Fail the migration instead of silently retaining ambiguous
-- lineage, then enforce the invariant on every future insert/update.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ExtractionJob" job
    JOIN "ProjectFile" file ON file."id" = job."projectFileId"
    WHERE job."companyId" IS DISTINCT FROM file."companyId"
       OR job."projectId" IS DISTINCT FROM file."projectId"
  ) THEN
    RAISE EXCEPTION 'Extraction job lineage mismatch detected; repair before applying evidence retention.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION "enforce_extraction_job_file_lineage"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
    FROM "ProjectFile"
    WHERE "id" = NEW."projectFileId"
      AND "companyId" = NEW."companyId"
      AND "projectId" = NEW."projectId"
      AND "status" <> 'ARCHIVED'
    FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extraction job must match an active project file tenant and project.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExtractionJob_file_lineage_guard"
BEFORE INSERT OR UPDATE OF "companyId", "projectId", "projectFileId" ON "ExtractionJob"
FOR EACH ROW EXECUTE FUNCTION "enforce_extraction_job_file_lineage"();

-- Once archived, a source row is immutable. Direct retrieval remains valid,
-- but background jobs and ad-hoc SQL cannot reactivate or rewrite its identity.
CREATE FUNCTION "protect_archived_project_file"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'ARCHIVED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Archived project files are immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProjectFile_archived_immutable"
BEFORE UPDATE ON "ProjectFile"
FOR EACH ROW EXECUTE FUNCTION "protect_archived_project_file"();

-- Proposal attachments are issued artifacts. Their parent link prevents
-- deletion; this trigger also prevents swapping bytes, hashes, lineage, or
-- authorship while the artifact is attached to proposal evidence.
CREATE FUNCTION "protect_proposal_generated_document"() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ClientProposalDocument"
    WHERE "generatedDocumentId" = OLD."id"
  ) AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Proposal document evidence is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GeneratedDocument_proposal_evidence_immutable"
BEFORE UPDATE ON "GeneratedDocument"
FOR EACH ROW EXECUTE FUNCTION "protect_proposal_generated_document"();

-- Completion freezes the governed report snapshot and stored artifact. Share
-- token rotation/revocation remains allowed because those fields are not part
-- of the retained document evidence tested below.
CREATE FUNCTION "protect_completed_technical_report"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' AND (
    NEW."companyId" IS DISTINCT FROM OLD."companyId" OR
    NEW."projectId" IS DISTINCT FROM OLD."projectId" OR
    NEW."templateId" IS DISTINCT FROM OLD."templateId" OR
    NEW."templateVersionId" IS DISTINCT FROM OLD."templateVersionId" OR
    NEW."name" IS DISTINCT FROM OLD."name" OR
    NEW."status" IS DISTINCT FROM OLD."status" OR
    NEW."sectionsSnapshotJson" IS DISTINCT FROM OLD."sectionsSnapshotJson" OR
    NEW."placeholdersJson" IS DISTINCT FROM OLD."placeholdersJson" OR
    NEW."fieldValuesJson" IS DISTINCT FROM OLD."fieldValuesJson" OR
    NEW."documentType" IS DISTINCT FROM OLD."documentType" OR
    NEW."storageKey" IS DISTINCT FROM OLD."storageKey" OR
    NEW."fileName" IS DISTINCT FROM OLD."fileName" OR
    NEW."mimeType" IS DISTINCT FROM OLD."mimeType" OR
    NEW."fileSize" IS DISTINCT FROM OLD."fileSize" OR
    NEW."checksum" IS DISTINCT FROM OLD."checksum" OR
    NEW."generatedByUserId" IS DISTINCT FROM OLD."generatedByUserId" OR
    NEW."generatedByName" IS DISTINCT FROM OLD."generatedByName" OR
    NEW."errorMessage" IS DISTINCT FROM OLD."errorMessage" OR
    NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR
    NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
  ) THEN
    RAISE EXCEPTION 'Completed technical report evidence is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GeneratedTechnicalReport_completed_immutable"
BEFORE UPDATE ON "GeneratedTechnicalReport"
FOR EACH ROW EXECUTE FUNCTION "protect_completed_technical_report"();
