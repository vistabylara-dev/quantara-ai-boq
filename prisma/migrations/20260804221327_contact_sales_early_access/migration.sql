-- CreateTable
CREATE TABLE "EarlyAccessRegistration" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "interestTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlyAccessRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSalesRequest" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "accountingPlatform" TEXT NOT NULL,
    "businessSize" TEXT NOT NULL,
    "numberOfEntities" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "privacyConsent" BOOLEAN NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'stored',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSalesRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EarlyAccessRegistration_email_idx" ON "EarlyAccessRegistration"("email");

-- CreateIndex
CREATE INDEX "ContactSalesRequest_businessEmail_idx" ON "ContactSalesRequest"("businessEmail");
