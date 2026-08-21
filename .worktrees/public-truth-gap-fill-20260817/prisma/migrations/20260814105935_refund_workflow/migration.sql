-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundAction" AS ENUM ('REFUND_ONLY', 'REFUND_AND_CANCEL');

-- CreateEnum
CREATE TYPE "RefundExceptionCategory" AS ENUM ('DUPLICATE_CHARGE', 'INCORRECT_BILLING', 'PROVIDER_ERROR', 'LEGAL_REMEDY');

-- NOTE: prisma migrate dev's auto-diff generated DROP INDEX statements for the
-- three MasterItem pg_trgm/GIN search indexes here, as it has on every prior
-- migration in this repo that touches an unrelated table — those indexes are
-- intentionally managed outside Prisma's schema DSL (see
-- 20260810195100_stripe_commercial_checkout's own header comment) and must
-- never be dropped by an unrelated migration. Removed deliberately.

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "approvedByUserId" UUID,
    "companySoftwareSubscriptionId" UUID,
    "externalSubscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "stripeRefundId" TEXT,
    "originalAmountMinor" INTEGER NOT NULL,
    "requestedAmountMinor" INTEGER NOT NULL,
    "currency" "CommerceCurrency" NOT NULL DEFAULT 'AED',
    "reason" TEXT NOT NULL,
    "successfulPaymentAt" TIMESTAMP(3) NOT NULL,
    "isException" BOOLEAN NOT NULL DEFAULT false,
    "exceptionCategory" "RefundExceptionCategory",
    "action" "RefundAction",
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "rejectionReason" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundRequest_companyId_idx" ON "RefundRequest"("companyId");

-- CreateIndex
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");

-- CreateIndex
CREATE INDEX "RefundRequest_stripePaymentIntentId_idx" ON "RefundRequest"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "RefundRequest_externalSubscriptionId_idx" ON "RefundRequest"("externalSubscriptionId");

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_companySoftwareSubscriptionId_fkey" FOREIGN KEY ("companySoftwareSubscriptionId") REFERENCES "CompanySoftwareSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
