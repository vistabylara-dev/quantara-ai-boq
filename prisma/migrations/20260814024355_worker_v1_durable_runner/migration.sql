-- CreateEnum
CREATE TYPE "WorkerRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkerPlannerMode" AS ENUM ('DETERMINISTIC_ONLY', 'BOUNDED_AI');

-- CreateEnum
CREATE TYPE "WorkerRunEventType" AS ENUM ('RUN_ENQUEUED', 'LEASE_ACQUIRED', 'RETRY_SCHEDULED', 'DETERMINISTIC_REVIEW_LINKED', 'AI_PLANNER_SKIPPED', 'AI_PLAN_RECORDED', 'RUN_COMPLETED', 'RUN_FAILED');

-- CreateTable
CREATE TABLE "WorkerRun" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "assignmentType" "WorkerAssignmentType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "WorkerRunStatus" NOT NULL DEFAULT 'QUEUED',
    "plannerMode" "WorkerPlannerMode" NOT NULL DEFAULT 'DETERMINISTIC_ONLY',
    "sourceBoqVersion" INTEGER NOT NULL,
    "sourceVerifiedVersion" INTEGER,
    "sourceRevisionNumber" INTEGER NOT NULL,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 3,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "requestedByUserId" UUID NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "resultAssignmentId" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRunEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "workerRunId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "eventType" "WorkerRunEventType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAIPlan" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "workerRunId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "plannerVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "providerResponseId" TEXT,
    "contextSha256" TEXT NOT NULL,
    "contextSummaryJson" JSONB NOT NULL,
    "planJson" JSONB NOT NULL,
    "usageJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerAIPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRun_resultAssignmentId_key" ON "WorkerRun"("resultAssignmentId");

-- CreateIndex
CREATE INDEX "WorkerRun_status_availableAt_idx" ON "WorkerRun"("status", "availableAt");

-- CreateIndex
CREATE INDEX "WorkerRun_companyId_createdAt_idx" ON "WorkerRun"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRun_projectId_createdAt_idx" ON "WorkerRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRun_boqId_createdAt_idx" ON "WorkerRun"("boqId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRun_leaseExpiresAt_idx" ON "WorkerRun"("leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRun_companyId_assignmentType_idempotencyKey_key" ON "WorkerRun"("companyId", "assignmentType", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkerRunEvent_companyId_projectId_idx" ON "WorkerRunEvent"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerRunEvent_boqId_idx" ON "WorkerRunEvent"("boqId");

-- CreateIndex
CREATE INDEX "WorkerRunEvent_eventType_createdAt_idx" ON "WorkerRunEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRunEvent_workerRunId_sequenceNumber_key" ON "WorkerRunEvent"("workerRunId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAIPlan_workerRunId_key" ON "WorkerAIPlan"("workerRunId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAIPlan_assignmentId_key" ON "WorkerAIPlan"("assignmentId");

-- CreateIndex
CREATE INDEX "WorkerAIPlan_companyId_projectId_idx" ON "WorkerAIPlan"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "WorkerAIPlan_boqId_idx" ON "WorkerAIPlan"("boqId");

-- AddForeignKey
ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_resultAssignmentId_fkey" FOREIGN KEY ("resultAssignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRunEvent" ADD CONSTRAINT "WorkerRunEvent_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "WorkerRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAIPlan" ADD CONSTRAINT "WorkerAIPlan_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "WorkerRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAIPlan" ADD CONSTRAINT "WorkerAIPlan_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_attempt_bounds"
CHECK (
  "maximumAttempts" BETWEEN 1 AND 10
  AND "attempts" BETWEEN 0 AND "maximumAttempts"
);

ALTER TABLE "WorkerRun" ADD CONSTRAINT "WorkerRun_idempotency_key_bounds"
CHECK (
  LENGTH(BTRIM("idempotencyKey")) BETWEEN 8 AND 200
  AND "idempotencyKey" = BTRIM("idempotencyKey")
);

ALTER TABLE "WorkerRunEvent" ADD CONSTRAINT "WorkerRunEvent_positive_sequence"
CHECK ("sequenceNumber" > 0);

ALTER TABLE "WorkerAIPlan" ADD CONSTRAINT "WorkerAIPlan_context_sha256"
CHECK ("contextSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "WorkerAIPlan" ADD CONSTRAINT "WorkerAIPlan_bounded_metadata"
CHECK (
  "provider" = 'openai'
  AND LENGTH(BTRIM("plannerVersion")) BETWEEN 1 AND 200
  AND LENGTH(BTRIM("model")) BETWEEN 1 AND 200
);

CREATE FUNCTION "enforce_worker_run"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "BOQ" boq
  JOIN "Project" project ON project."id" = boq."projectId"
  WHERE boq."id" = NEW."boqId"
    AND boq."companyId" = NEW."companyId"
    AND boq."projectId" = NEW."projectId"
    AND project."companyId" = NEW."companyId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker run must match its BOQ tenant and project.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM "User"
  WHERE "id" = NEW."requestedByUserId"
    AND "companyId" = NEW."companyId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker run requester crosses tenant boundaries.' USING ERRCODE = '23514';
  END IF;

  IF NEW."sourceBoqVersion" < 1 OR NEW."sourceRevisionNumber" < 1 THEN
    RAISE EXCEPTION 'Worker run source versions must be positive.' USING ERRCODE = '23514';
  END IF;

  IF NEW."assignmentType" <> 'REVIEW_EXISTING_BOQ' THEN
    RAISE EXCEPTION 'Durable worker V1 only accepts REVIEW_EXISTING_BOQ assignments.' USING ERRCODE = '23514';
  END IF;

  IF NEW."resultAssignmentId" IS NOT NULL THEN
    PERFORM 1 FROM "WorkerAssignment"
    WHERE "id" = NEW."resultAssignmentId"
      AND "companyId" = NEW."companyId"
      AND "projectId" = NEW."projectId"
      AND "boqId" = NEW."boqId"
      AND "assignmentType" = NEW."assignmentType";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker run result assignment crosses governed lineage.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."status" = 'QUEUED' THEN
    IF NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL OR NEW."lastHeartbeatAt" IS NOT NULL
       OR NEW."completedAt" IS NOT NULL OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Queued worker run cannot carry a lease or terminal fields.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" = 'RUNNING' THEN
    IF NEW."attempts" < 1 OR NULLIF(BTRIM(NEW."leaseOwner"), '') IS NULL
       OR NEW."leaseExpiresAt" IS NULL OR NEW."lastHeartbeatAt" IS NULL OR NEW."startedAt" IS NULL
       OR NEW."completedAt" IS NOT NULL OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Running worker run requires an active lease and no terminal fields.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" = 'COMPLETED' THEN
    IF NEW."resultAssignmentId" IS NULL OR NEW."completedAt" IS NULL
       OR NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL OR NEW."lastHeartbeatAt" IS NOT NULL
       OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Completed worker run requires a result assignment and clean terminal state.' USING ERRCODE = '23514';
    END IF;
    IF NEW."plannerMode" = 'BOUNDED_AI' THEN
      PERFORM 1 FROM "WorkerAIPlan" WHERE "workerRunId" = NEW."id";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A bounded-AI worker run cannot complete without its immutable advisory plan.' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF NEW."status" = 'FAILED' THEN
    IF NEW."completedAt" IS NULL OR NULLIF(BTRIM(NEW."failureCode"), '') IS NULL OR NULLIF(BTRIM(NEW."failureMessage"), '') IS NULL
       OR NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL OR NEW."lastHeartbeatAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Failed worker run requires a code, message, timestamp, and no active lease.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" = 'CANCELLED' THEN
    IF NEW."completedAt" IS NULL OR NEW."leaseOwner" IS NOT NULL OR NEW."leaseExpiresAt" IS NOT NULL
       OR NEW."lastHeartbeatAt" IS NOT NULL OR NEW."failureCode" IS NOT NULL OR NEW."failureMessage" IS NOT NULL THEN
      RAISE EXCEPTION 'Cancelled worker run requires a clean terminal state.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('COMPLETED', 'FAILED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Terminal worker runs are immutable.' USING ERRCODE = '23514';
    END IF;
    IF OLD."status" = 'QUEUED' AND NEW."status" NOT IN ('QUEUED', 'RUNNING', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid worker run transition from QUEUED.' USING ERRCODE = '23514';
    END IF;
    IF OLD."status" = 'RUNNING' AND NEW."status" NOT IN ('RUNNING', 'QUEUED', 'COMPLETED', 'FAILED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid worker run transition from RUNNING.' USING ERRCODE = '23514';
    END IF;
    IF NEW."attempts" < OLD."attempts" OR NEW."attempts" > NEW."maximumAttempts" THEN
      RAISE EXCEPTION 'Worker run attempt count cannot decrease or exceed its maximum.' USING ERRCODE = '23514';
    END IF;
    IF OLD."resultAssignmentId" IS NOT NULL AND NEW."resultAssignmentId" IS DISTINCT FROM OLD."resultAssignmentId" THEN
      RAISE EXCEPTION 'Worker run result assignment is immutable once linked.' USING ERRCODE = '23514';
    END IF;
    IF ROW(
      NEW."companyId",
      NEW."projectId",
      NEW."boqId",
      NEW."assignmentType",
      NEW."idempotencyKey",
      NEW."plannerMode",
      NEW."sourceBoqVersion",
      NEW."sourceVerifiedVersion",
      NEW."sourceRevisionNumber",
      NEW."maximumAttempts",
      NEW."requestedByUserId",
      NEW."requestedByName",
      NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."companyId",
      OLD."projectId",
      OLD."boqId",
      OLD."assignmentType",
      OLD."idempotencyKey",
      OLD."plannerMode",
      OLD."sourceBoqVersion",
      OLD."sourceVerifiedVersion",
      OLD."sourceRevisionNumber",
      OLD."maximumAttempts",
      OLD."requestedByUserId",
      OLD."requestedByName",
      OLD."createdAt"
    ) THEN
      RAISE EXCEPTION 'Worker run target, idempotency and requester fields are immutable.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerRun_state_guard"
BEFORE INSERT OR UPDATE ON "WorkerRun"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_run"();

CREATE FUNCTION "protect_worker_run_delete"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Worker runs and their execution ledger cannot be deleted.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerRun_delete_guard"
BEFORE DELETE ON "WorkerRun"
FOR EACH ROW EXECUTE FUNCTION "protect_worker_run_delete"();

CREATE FUNCTION "enforce_worker_run_event"() RETURNS TRIGGER AS $$
DECLARE
  run_record "WorkerRun"%ROWTYPE;
BEGIN
  SELECT * INTO run_record FROM "WorkerRun"
  WHERE "id" = NEW."workerRunId"
    AND "companyId" = NEW."companyId"
    AND "projectId" = NEW."projectId"
    AND "boqId" = NEW."boqId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker run event crosses run lineage.' USING ERRCODE = '23514';
  END IF;

  IF NEW."eventType" = 'RUN_ENQUEUED' AND run_record."status" <> 'QUEUED' THEN
    RAISE EXCEPTION 'RUN_ENQUEUED requires a queued run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'LEASE_ACQUIRED' AND run_record."status" <> 'RUNNING' THEN
    RAISE EXCEPTION 'LEASE_ACQUIRED requires a running run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'RETRY_SCHEDULED' AND run_record."status" <> 'QUEUED' THEN
    RAISE EXCEPTION 'RETRY_SCHEDULED requires a requeued run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'DETERMINISTIC_REVIEW_LINKED'
        AND (run_record."status" <> 'RUNNING' OR run_record."resultAssignmentId" IS NULL) THEN
    RAISE EXCEPTION 'DETERMINISTIC_REVIEW_LINKED requires a linked running run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'AI_PLANNER_SKIPPED'
        AND (run_record."status" <> 'RUNNING' OR run_record."plannerMode" <> 'DETERMINISTIC_ONLY') THEN
    RAISE EXCEPTION 'AI_PLANNER_SKIPPED requires a deterministic-only running run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'AI_PLAN_RECORDED' THEN
    IF run_record."status" <> 'RUNNING'
       OR NOT EXISTS (SELECT 1 FROM "WorkerAIPlan" WHERE "workerRunId" = NEW."workerRunId") THEN
      RAISE EXCEPTION 'AI_PLAN_RECORDED requires an immutable plan on a running run.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."eventType" = 'RUN_COMPLETED' AND run_record."status" <> 'COMPLETED' THEN
    RAISE EXCEPTION 'RUN_COMPLETED requires a completed run.' USING ERRCODE = '23514';
  ELSIF NEW."eventType" = 'RUN_FAILED' AND run_record."status" <> 'FAILED' THEN
    RAISE EXCEPTION 'RUN_FAILED requires a failed run.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerRunEvent_lineage_guard"
BEFORE INSERT ON "WorkerRunEvent"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_run_event"();

CREATE FUNCTION "enforce_worker_ai_plan"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "WorkerRun" run
  JOIN "WorkerAssignment" assignment ON assignment."id" = NEW."assignmentId"
  WHERE run."id" = NEW."workerRunId"
    AND run."companyId" = NEW."companyId"
    AND run."projectId" = NEW."projectId"
    AND run."boqId" = NEW."boqId"
    AND run."plannerMode" = 'BOUNDED_AI'
    AND run."resultAssignmentId" = assignment."id"
    AND assignment."companyId" = NEW."companyId"
    AND assignment."projectId" = NEW."projectId"
    AND assignment."boqId" = NEW."boqId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker AI plan must match a bounded-AI run and its immutable assignment.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerAIPlan_lineage_guard"
BEFORE INSERT ON "WorkerAIPlan"
FOR EACH ROW EXECUTE FUNCTION "enforce_worker_ai_plan"();

CREATE FUNCTION "protect_immutable_worker_v1_record"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Worker run events and AI plans are immutable.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerRunEvent_immutable"
BEFORE UPDATE OR DELETE ON "WorkerRunEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_worker_v1_record"();

CREATE TRIGGER "WorkerAIPlan_immutable"
BEFORE UPDATE OR DELETE ON "WorkerAIPlan"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_worker_v1_record"();

CREATE FUNCTION "protect_terminal_worker_assignment"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" IN ('COMPLETED', 'NEEDS_INPUT', 'FAILED', 'CANCELLED')
     AND ROW(NEW."status", NEW."completedAt", NEW."failureCode", NEW."failureMessage")
       IS DISTINCT FROM ROW(OLD."status", OLD."completedAt", OLD."failureCode", OLD."failureMessage") THEN
    RAISE EXCEPTION 'Terminal worker assignment outcome is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerAssignment_terminal_guard"
BEFORE UPDATE ON "WorkerAssignment"
FOR EACH ROW EXECUTE FUNCTION "protect_terminal_worker_assignment"();
