-- CreateEnum
CREATE TYPE "WorkerAssignmentType" AS ENUM ('REVIEW_EXISTING_BOQ');

-- CreateEnum
CREATE TYPE "WorkerAssignmentStatus" AS ENUM ('RUNNING', 'NEEDS_INPUT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkerReviewConclusion" AS ENUM ('CLEAR', 'CLEAR_WITH_OBSERVATIONS', 'NEEDS_INPUT');

-- CreateEnum
CREATE TYPE "WorkerDecisionOutcome" AS ENUM ('PASS', 'OBSERVATION', 'NEEDS_INPUT');

-- CreateEnum
CREATE TYPE "WorkerDecisionSeverity" AS ENUM ('INFO', 'WARNING', 'MATERIAL');

-- CreateEnum
CREATE TYPE "WorkerDecisionCode" AS ENUM ('BOQ_REVIEW_CLEAR', 'BOQ_EMPTY', 'BOQ_VERIFICATION_STALE', 'UNRESOLVED_CRITICAL_EXCEPTION', 'UNRESOLVED_WARNING_EXCEPTION', 'QUANTITY_PROVENANCE_MISSING', 'QUANTITY_PROVENANCE_UNCONFIRMED', 'QUANTITY_PROVENANCE_MISMATCH', 'RATE_PROVENANCE_MISSING', 'RATE_PROVENANCE_UNCONFIRMED', 'RATE_PROVENANCE_MISMATCH', 'RATE_SOURCE_EXPIRED', 'LOCKED_REVISION_SNAPSHOT_MISSING', 'LOCKED_REVISION_EVIDENCE_MISSING');

-- CreateEnum
CREATE TYPE "WorkerMaterialQuestionType" AS ENUM ('CONFIRM_EMPTY_BOQ_SCOPE', 'RUN_CURRENT_VERIFICATION', 'RESOLVE_CRITICAL_VERIFICATION_EXCEPTION', 'CONFIRM_QUANTITY_PROVENANCE', 'CONFIRM_RATE_PROVENANCE', 'CONFIRM_EXPIRED_RATE_SOURCE', 'RESTORE_LOCKED_REVISION_EVIDENCE');

-- CreateEnum
CREATE TYPE "WorkerMaterialQuestionStatus" AS ENUM ('OPEN', 'ANSWERED');

-- CreateEnum
CREATE TYPE "WorkerEventType" AS ENUM ('ASSIGNMENT_CREATED', 'INSPECTION_STARTED', 'WORKSPACE_CAPTURED', 'DECISIONS_RECORDED', 'MATERIAL_QUESTIONS_OPENED', 'MATERIAL_QUESTION_ANSWERED', 'REVIEW_COMPLETED', 'REVIEW_NEEDS_INPUT', 'REVIEW_FAILED');

-- CreateTable
CREATE TABLE "WorkerAssignment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentType" "WorkerAssignmentType" NOT NULL,
    "status" "WorkerAssignmentStatus" NOT NULL DEFAULT 'RUNNING',
    "inspectionVersion" TEXT NOT NULL,
    "inspectionAsOf" TIMESTAMP(3) NOT NULL,
    "sourceBoqVersion" INTEGER NOT NULL,
    "sourceVerifiedVersion" INTEGER,
    "sourceRevisionNumber" INTEGER NOT NULL,
    "requestedByUserId" UUID,
    "requestedByName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerReviewWorkspace" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "conclusion" "WorkerReviewConclusion" NOT NULL,
    "sectionCount" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "activeItemCount" INTEGER NOT NULL,
    "confirmedQuantityCount" INTEGER NOT NULL,
    "confirmedRateCount" INTEGER NOT NULL,
    "unresolvedCriticalCount" INTEGER NOT NULL,
    "unresolvedWarningCount" INTEGER NOT NULL,
    "revisionEvidenceCount" INTEGER NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerReviewWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerDecision" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "code" "WorkerDecisionCode" NOT NULL,
    "outcome" "WorkerDecisionOutcome" NOT NULL,
    "severity" "WorkerDecisionSeverity" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID,
    "summary" TEXT NOT NULL,
    "rationaleJson" JSONB NOT NULL,
    "evidenceRefsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerMaterialQuestion" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "questionType" "WorkerMaterialQuestionType" NOT NULL,
    "status" "WorkerMaterialQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID,
    "prompt" TEXT NOT NULL,
    "whyMaterial" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "answeredByUserId" UUID,
    "answerJson" JSONB,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerMaterialQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "eventType" "WorkerEventType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerAssignment_companyId_createdAt_idx" ON "WorkerAssignment"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerAssignment_projectId_createdAt_idx" ON "WorkerAssignment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerAssignment_boqId_createdAt_idx" ON "WorkerAssignment"("boqId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerAssignment_status_createdAt_idx" ON "WorkerAssignment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerReviewWorkspace_assignmentId_key" ON "WorkerReviewWorkspace"("assignmentId");

-- CreateIndex
CREATE INDEX "WorkerReviewWorkspace_companyId_projectId_idx" ON "WorkerReviewWorkspace"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerReviewWorkspace_boqId_idx" ON "WorkerReviewWorkspace"("boqId");

-- CreateIndex
CREATE INDEX "WorkerDecision_companyId_projectId_idx" ON "WorkerDecision"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerDecision_boqId_idx" ON "WorkerDecision"("boqId");

-- CreateIndex
CREATE INDEX "WorkerDecision_code_idx" ON "WorkerDecision"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerDecision_assignmentId_sequenceNumber_key" ON "WorkerDecision"("assignmentId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerMaterialQuestion_decisionId_key" ON "WorkerMaterialQuestion"("decisionId");

-- CreateIndex
CREATE INDEX "WorkerMaterialQuestion_companyId_projectId_idx" ON "WorkerMaterialQuestion"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerMaterialQuestion_boqId_idx" ON "WorkerMaterialQuestion"("boqId");

-- CreateIndex
CREATE INDEX "WorkerMaterialQuestion_status_createdAt_idx" ON "WorkerMaterialQuestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerEvent_companyId_projectId_idx" ON "WorkerEvent"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerEvent_boqId_idx" ON "WorkerEvent"("boqId");

-- CreateIndex
CREATE INDEX "WorkerEvent_eventType_createdAt_idx" ON "WorkerEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerEvent_assignmentId_sequenceNumber_key" ON "WorkerEvent"("assignmentId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerReviewWorkspace" ADD CONSTRAINT "WorkerReviewWorkspace_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDecision" ADD CONSTRAINT "WorkerDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMaterialQuestion" ADD CONSTRAINT "WorkerMaterialQuestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMaterialQuestion" ADD CONSTRAINT "WorkerMaterialQuestion_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "WorkerDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerEvent" ADD CONSTRAINT "WorkerEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerMaterialQuestion" ADD CONSTRAINT "WorkerMaterialQuestion_answeredByUserId_fkey"
FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerReviewWorkspace" ADD CONSTRAINT "WorkerReviewWorkspace_nonnegative_counts"
CHECK (
  "sectionCount" >= 0
  AND "itemCount" >= 0
  AND "activeItemCount" >= 0
  AND "confirmedQuantityCount" >= 0
  AND "confirmedRateCount" >= 0
  AND "unresolvedCriticalCount" >= 0
  AND "unresolvedWarningCount" >= 0
  AND "revisionEvidenceCount" >= 0
);

ALTER TABLE "WorkerDecision" ADD CONSTRAINT "WorkerDecision_positive_sequence"
CHECK ("sequenceNumber" > 0);

ALTER TABLE "WorkerEvent" ADD CONSTRAINT "WorkerEvent_positive_sequence"
CHECK ("sequenceNumber" > 0);

ALTER TABLE "WorkerMaterialQuestion" ADD CONSTRAINT "WorkerMaterialQuestion_answer_state"
CHECK (
  (
    "status" = 'OPEN'
    AND "answeredByUserId" IS NULL
    AND "answerJson" IS NULL
    AND "answeredAt" IS NULL
  )
  OR
  (
    "status" = 'ANSWERED'
    AND "answeredByUserId" IS NOT NULL
    AND "answerJson" IS NOT NULL
    AND "answeredAt" IS NOT NULL
  )
);

CREATE FUNCTION "enforce_worker_assignment_lineage"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "BOQ" boq
  JOIN "Project" project ON project."id" = boq."projectId"
  WHERE boq."id" = NEW."boqId"
    AND boq."companyId" = NEW."companyId"
    AND boq."projectId" = NEW."projectId"
    AND project."companyId" = NEW."companyId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker assignment must match its BOQ tenant and project.' USING ERRCODE = '23514';
  END IF;

  IF NEW."requestedByUserId" IS NOT NULL THEN
    PERFORM 1 FROM "User"
    WHERE "id" = NEW."requestedByUserId"
      AND "companyId" = NEW."companyId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker assignment requester crosses tenant boundaries.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."sourceBoqVersion" < 1 OR NEW."sourceRevisionNumber" < 1 THEN
    RAISE EXCEPTION 'Worker assignment source versions must be positive.' USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'RUNNING' THEN
    IF NEW."completedAt" IS NOT NULL OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Running worker assignment cannot carry terminal fields.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" IN ('COMPLETED', 'NEEDS_INPUT', 'CANCELLED') THEN
    IF NEW."completedAt" IS NULL OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Terminal worker assignment status requires a clean completion timestamp.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" = 'FAILED' THEN
    IF NEW."completedAt" IS NULL OR NULLIF(BTRIM(NEW."failureCode"), '') IS NULL OR NULLIF(BTRIM(NEW."failureMessage"), '') IS NULL THEN
      RAISE EXCEPTION 'Failed worker assignment requires a timestamp, code and message.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND ROW(
    NEW."companyId",
    NEW."projectId",
    NEW."boqId",
    NEW."assignmentType",
    NEW."inspectionVersion",
    NEW."inspectionAsOf",
    NEW."sourceBoqVersion",
    NEW."sourceVerifiedVersion",
    NEW."sourceRevisionNumber",
    NEW."requestedByUserId",
    NEW."requestedByName",
    NEW."startedAt",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."companyId",
    OLD."projectId",
    OLD."boqId",
    OLD."assignmentType",
    OLD."inspectionVersion",
    OLD."inspectionAsOf",
    OLD."sourceBoqVersion",
    OLD."sourceVerifiedVersion",
    OLD."sourceRevisionNumber",
    OLD."requestedByUserId",
    OLD."requestedByName",
    OLD."startedAt",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Worker assignment source and requester fields are immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerAssignment_lineage_guard"
BEFORE INSERT OR UPDATE ON "WorkerAssignment"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_assignment_lineage"();

CREATE FUNCTION "protect_worker_assignment_delete"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Worker assignments and their review ledger cannot be deleted.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerAssignment_delete_guard"
BEFORE DELETE ON "WorkerAssignment"
FOR EACH ROW EXECUTE FUNCTION "protect_worker_assignment_delete"();

CREATE FUNCTION "enforce_worker_child_lineage"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1 FROM "WorkerAssignment"
  WHERE "id" = NEW."assignmentId"
    AND "companyId" = NEW."companyId"
    AND "projectId" = NEW."projectId"
    AND "boqId" = NEW."boqId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker record crosses assignment tenant, project or BOQ boundaries.' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'WorkerMaterialQuestion' THEN
    PERFORM 1 FROM "WorkerDecision"
    WHERE "id" = NEW."decisionId"
      AND "assignmentId" = NEW."assignmentId"
      AND "companyId" = NEW."companyId"
      AND "projectId" = NEW."projectId"
      AND "boqId" = NEW."boqId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker material question must match its decision lineage.' USING ERRCODE = '23514';
    END IF;

    IF NEW."answeredByUserId" IS NOT NULL THEN
      PERFORM 1 FROM "User"
      WHERE "id" = NEW."answeredByUserId"
        AND "companyId" = NEW."companyId";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker material-question answer crosses tenant boundaries.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerReviewWorkspace_lineage_guard"
BEFORE INSERT ON "WorkerReviewWorkspace"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_child_lineage"();

CREATE TRIGGER "WorkerDecision_lineage_guard"
BEFORE INSERT ON "WorkerDecision"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_child_lineage"();

CREATE TRIGGER "WorkerMaterialQuestion_lineage_guard"
BEFORE INSERT OR UPDATE ON "WorkerMaterialQuestion"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_child_lineage"();

CREATE TRIGGER "WorkerEvent_lineage_guard"
BEFORE INSERT ON "WorkerEvent"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_child_lineage"();

CREATE FUNCTION "protect_immutable_worker_record"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Worker decisions, events and captured workspaces are immutable.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerReviewWorkspace_immutable"
BEFORE UPDATE OR DELETE ON "WorkerReviewWorkspace"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_worker_record"();

CREATE TRIGGER "WorkerDecision_immutable"
BEFORE UPDATE OR DELETE ON "WorkerDecision"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_worker_record"();

CREATE TRIGGER "WorkerEvent_immutable"
BEFORE UPDATE OR DELETE ON "WorkerEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_worker_record"();

CREATE FUNCTION "protect_worker_material_question"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Worker material questions cannot be deleted.' USING ERRCODE = '23514';
  END IF;

  IF ROW(
    NEW."companyId",
    NEW."projectId",
    NEW."boqId",
    NEW."assignmentId",
    NEW."decisionId",
    NEW."questionType",
    NEW."subjectType",
    NEW."subjectId",
    NEW."prompt",
    NEW."whyMaterial",
    NEW."recommendedAction",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."companyId",
    OLD."projectId",
    OLD."boqId",
    OLD."assignmentId",
    OLD."decisionId",
    OLD."questionType",
    OLD."subjectType",
    OLD."subjectId",
    OLD."prompt",
    OLD."whyMaterial",
    OLD."recommendedAction",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Worker material-question evidence is immutable.' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" <> 'OPEN' OR NEW."status" <> 'ANSWERED'
     OR NEW."answeredByUserId" IS NULL OR NEW."answerJson" IS NULL OR NEW."answeredAt" IS NULL THEN
    RAISE EXCEPTION 'Worker material question supports exactly one complete answer.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerMaterialQuestion_answer_guard"
BEFORE UPDATE OR DELETE ON "WorkerMaterialQuestion"
FOR EACH ROW EXECUTE FUNCTION "protect_worker_material_question"();
