-- Add registration metadata to Company
ALTER TABLE "Company"
  ADD COLUMN "primaryIndustry" TEXT,
  ADD COLUMN "monthlyVolume" TEXT;

-- Add registration metadata to User
ALTER TABLE "User"
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "marketingConsent" BOOLEAN;

-- CreateTable
CREATE TABLE "SalesInquiry" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "companyType" TEXT,
    "constructionDiscipline" TEXT,
    "currentBoqProcess" TEXT,
    "monthlyVolume" TEXT,
    "requiredInputs" TEXT,
    "requiredOutputs" TEXT,
    "numberOfUsers" TEXT,
    "integrationRequirements" TEXT,
    "preferredContactMethod" TEXT,
    "consent" BOOLEAN,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'stored',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInquiry_pkey" PRIMARY KEY ("id")
);
