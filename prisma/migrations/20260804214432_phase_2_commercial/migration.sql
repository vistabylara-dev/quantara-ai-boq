-- CreateEnum
CREATE TYPE "AiCreditTransactionType" AS ENUM ('SUBSCRIPTION_GRANT', 'TOP_UP_PURCHASE', 'QUESTION_ASKED', 'REPORT_GENERATED', 'EXPIRED', 'ADMIN_ADJUSTMENT');

-- DropIndex
DROP INDEX "MasterItem_itemCode_trgm_idx";

-- DropIndex
DROP INDEX "MasterItem_name_trgm_idx";

-- DropIndex
DROP INDEX "MasterItem_shortDescription_trgm_idx";

-- CreateTable
CREATE TABLE "CompanyAiCreditBalance" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "availableCredits" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAiCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCreditTransaction" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "amount" INTEGER NOT NULL,
    "transactionType" "AiCreditTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvoice" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "invoicePdfUrl" TEXT,
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAiCreditBalance_companyId_key" ON "CompanyAiCreditBalance"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAiCreditBalance_companyId_idx" ON "CompanyAiCreditBalance"("companyId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_companyId_idx" ON "AiCreditTransaction"("companyId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_userId_idx" ON "AiCreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "AiCreditTransaction_createdAt_idx" ON "AiCreditTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyInvoice_companyId_idx" ON "CompanyInvoice"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInvoice_status_idx" ON "CompanyInvoice"("status");

-- AddForeignKey
ALTER TABLE "CompanyAiCreditBalance" ADD CONSTRAINT "CompanyAiCreditBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditTransaction" ADD CONSTRAINT "AiCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvoice" ADD CONSTRAINT "CompanyInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
