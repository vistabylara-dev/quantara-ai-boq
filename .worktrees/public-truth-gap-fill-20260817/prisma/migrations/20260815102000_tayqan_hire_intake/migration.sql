-- TAYQAN-HIRE-1
-- Additive only: dedicated TAYQAN paid-worker entitlements, intake conversation,
-- and durable resumable TAYQAN work-order persistence.
--
-- Deliberately does NOT modify existing SaaS subscriptions, refunds, catalogue
-- packages, BOQ workflow tables, historical migrations, or Stripe mappings.
--
-- TAYQAN products and prices are managed by Quantara's existing authoritative
-- commerce catalogue and its normal commercial-review / Stripe-sync pipeline.
-- This migration creates TAYQAN persistence only. It performs no commerce DML.

CREATE TYPE "TayqanHirePlan" AS ENUM ('DAY', 'WEEK', 'MONTHLY');
CREATE TYPE "TayqanHireStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'PAYMENT_FAILED');
CREATE TYPE "TayqanIntakeStatus" AS ENUM ('COLLECTING', 'NEEDS_INPUT', 'READY', 'WORK_STARTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TayqanIntakeMessageRole" AS ENUM ('TAYQAN', 'USER', 'SYSTEM');

CREATE TABLE "TayqanHireEntitlement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "purchasedByUserId" UUID,
    "plan" "TayqanHirePlan" NOT NULL,
    "status" "TayqanHireStatus" NOT NULL DEFAULT 'PENDING',
    "priceCode" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TayqanHireEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TayqanIntakeSession" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID,
    "hireEntitlementId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "status" "TayqanIntakeStatus" NOT NULL DEFAULT 'COLLECTING',
    "desiredDeliverable" TEXT,
    "measurementStandard" TEXT,
    "includeRates" BOOLEAN,
    "pricingBasis" TEXT,
    "exclusions" TEXT,
    "deadlineText" TEXT,
    "specialInstructions" TEXT,
    "authoritativeSourcePolicy" TEXT,
    "projectSnapshotJson" JSONB,
    "workerRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "TayqanIntakeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TayqanIntakeMessage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" "TayqanIntakeMessageRole" NOT NULL,
    "message" TEXT NOT NULL,
    "structuredDataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TayqanIntakeMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TayqanHireEntitlement_stripeCheckoutSessionId_key"
ON "TayqanHireEntitlement"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "TayqanHireEntitlement_stripePaymentIntentId_key"
ON "TayqanHireEntitlement"("stripePaymentIntentId");
CREATE UNIQUE INDEX "TayqanHireEntitlement_stripeSubscriptionId_key"
ON "TayqanHireEntitlement"("stripeSubscriptionId");
CREATE INDEX "TayqanHireEntitlement_companyId_idx"
ON "TayqanHireEntitlement"("companyId");
CREATE INDEX "TayqanHireEntitlement_companyId_status_idx"
ON "TayqanHireEntitlement"("companyId", "status");
CREATE INDEX "TayqanHireEntitlement_expiresAt_idx"
ON "TayqanHireEntitlement"("expiresAt");
CREATE INDEX "TayqanHireEntitlement_purchasedByUserId_idx"
ON "TayqanHireEntitlement"("purchasedByUserId");

CREATE UNIQUE INDEX "TayqanIntakeSession_workerRunId_key"
ON "TayqanIntakeSession"("workerRunId");
CREATE INDEX "TayqanIntakeSession_companyId_idx"
ON "TayqanIntakeSession"("companyId");
CREATE INDEX "TayqanIntakeSession_companyId_projectId_idx"
ON "TayqanIntakeSession"("companyId", "projectId");
CREATE INDEX "TayqanIntakeSession_hireEntitlementId_idx"
ON "TayqanIntakeSession"("hireEntitlementId");
CREATE INDEX "TayqanIntakeSession_status_idx"
ON "TayqanIntakeSession"("status");

CREATE INDEX "TayqanIntakeMessage_companyId_idx"
ON "TayqanIntakeMessage"("companyId");
CREATE INDEX "TayqanIntakeMessage_companyId_sessionId_createdAt_idx"
ON "TayqanIntakeMessage"("companyId", "sessionId", "createdAt");

-- TAYQAN COMPLETE WORKFLOW — additive resumable work-order persistence.
CREATE TYPE "TayqanWorkStatus" AS ENUM ('RUNNING', 'NEEDS_INPUT', 'READY_FOR_ACCEPTANCE', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "TayqanWorkStage" AS ENUM ('SOURCE_DISCOVERY', 'SOURCE_PROCESSING', 'EVIDENCE_REVIEW', 'QUANTITY_PREPARATION', 'RATE_PREPARATION', 'BOQ_ASSEMBLY', 'VALIDATION', 'READY_FOR_ACCEPTANCE');

CREATE TABLE "TayqanWorkOrder" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID,
    "intakeSessionId" UUID NOT NULL,
    "hireEntitlementId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "status" "TayqanWorkStatus" NOT NULL DEFAULT 'RUNNING',
    "stage" "TayqanWorkStage" NOT NULL DEFAULT 'SOURCE_DISCOVERY',
    "desiredDeliverable" TEXT NOT NULL,
    "includeRates" BOOLEAN NOT NULL DEFAULT false,
    "pricingBasis" TEXT,
    "authoritativeSourcePolicy" TEXT,
    "startIdempotencyKey" TEXT NOT NULL,
    "progressJson" JSONB,
    "blockerCode" TEXT,
    "blockerMessage" TEXT,
    "blockerJson" JSONB,
    "qaWorkerRunId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdvancedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TayqanWorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TayqanWorkEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "stage" "TayqanWorkStage" NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TayqanWorkEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TayqanWorkOrder_intakeSessionId_key" ON "TayqanWorkOrder"("intakeSessionId");
CREATE UNIQUE INDEX "TayqanWorkOrder_qaWorkerRunId_key" ON "TayqanWorkOrder"("qaWorkerRunId");
CREATE INDEX "TayqanWorkOrder_companyId_idx" ON "TayqanWorkOrder"("companyId");
CREATE INDEX "TayqanWorkOrder_companyId_projectId_idx" ON "TayqanWorkOrder"("companyId", "projectId");
CREATE INDEX "TayqanWorkOrder_companyId_status_idx" ON "TayqanWorkOrder"("companyId", "status");
CREATE INDEX "TayqanWorkOrder_stage_idx" ON "TayqanWorkOrder"("stage");
CREATE INDEX "TayqanWorkOrder_hireEntitlementId_idx" ON "TayqanWorkOrder"("hireEntitlementId");
CREATE INDEX "TayqanWorkEvent_companyId_idx" ON "TayqanWorkEvent"("companyId");
CREATE INDEX "TayqanWorkEvent_workOrderId_createdAt_idx" ON "TayqanWorkEvent"("workOrderId", "createdAt");
CREATE INDEX "TayqanWorkEvent_stage_idx" ON "TayqanWorkEvent"("stage");
ALTER TABLE "TayqanWorkEvent" ADD CONSTRAINT "TayqanWorkEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "TayqanWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
