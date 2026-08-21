-- CreateEnum
CREATE TYPE "ClientProposalStatus" AS ENUM ('DRAFT', 'READY', 'SENT', 'OPENED', 'COMMENTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClientProposalEventType" AS ENUM ('CREATED', 'READY', 'EMAIL_PREVIEWED', 'EMAIL_QUEUED', 'EMAIL_SENT', 'EMAIL_FAILED', 'LINK_OPENED', 'DOCUMENT_VIEWED', 'DOCUMENT_DOWNLOADED', 'OPTION_SELECTED', 'COMMENT_ADDED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED', 'LINK_REGENERATED');

-- CreateEnum
CREATE TYPE "ProposalActorType" AS ENUM ('INTERNAL', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailDispatchStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProposal" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "clientId" UUID NOT NULL,
    "createdByUserId" UUID,
    "createdByName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "ClientProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revisionRequestedAt" TIMESTAMP(3),
    "clientComment" TEXT,
    "approvalName" TEXT,
    "approvalEmail" TEXT,
    "rejectionReason" TEXT,
    "selectedOptionsJson" JSONB,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProposalDocument" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "clientProposalId" UUID NOT NULL,
    "generatedDocumentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProposalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProposalEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "clientProposalId" UUID NOT NULL,
    "eventType" "ClientProposalEventType" NOT NULL,
    "actorType" "ProposalActorType" NOT NULL,
    "actorUserId" UUID,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "ipHash" TEXT,
    "userAgentSummary" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDispatch" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID,
    "clientProposalId" UUID,
    "emailTemplateId" UUID,
    "createdByUserId" UUID,
    "createdByName" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "ccJson" JSONB,
    "bccJson" JSONB,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "EmailDispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_companyId_idx" ON "EmailTemplate"("companyId");

-- CreateIndex
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_companyId_code_key" ON "EmailTemplate"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProposal_tokenHash_key" ON "ClientProposal"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientProposal_companyId_idx" ON "ClientProposal"("companyId");

-- CreateIndex
CREATE INDEX "ClientProposal_projectId_idx" ON "ClientProposal"("projectId");

-- CreateIndex
CREATE INDEX "ClientProposal_boqId_idx" ON "ClientProposal"("boqId");

-- CreateIndex
CREATE INDEX "ClientProposal_tokenHash_idx" ON "ClientProposal"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientProposal_status_idx" ON "ClientProposal"("status");

-- CreateIndex
CREATE INDEX "ClientProposal_expiresAt_idx" ON "ClientProposal"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientProposalDocument_companyId_idx" ON "ClientProposalDocument"("companyId");

-- CreateIndex
CREATE INDEX "ClientProposalDocument_clientProposalId_idx" ON "ClientProposalDocument"("clientProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProposalDocument_clientProposalId_generatedDocumentId_key" ON "ClientProposalDocument"("clientProposalId", "generatedDocumentId");

-- CreateIndex
CREATE INDEX "ClientProposalEvent_companyId_idx" ON "ClientProposalEvent"("companyId");

-- CreateIndex
CREATE INDEX "ClientProposalEvent_clientProposalId_idx" ON "ClientProposalEvent"("clientProposalId");

-- CreateIndex
CREATE INDEX "ClientProposalEvent_eventType_idx" ON "ClientProposalEvent"("eventType");

-- CreateIndex
CREATE INDEX "EmailDispatch_companyId_idx" ON "EmailDispatch"("companyId");

-- CreateIndex
CREATE INDEX "EmailDispatch_projectId_idx" ON "EmailDispatch"("projectId");

-- CreateIndex
CREATE INDEX "EmailDispatch_clientProposalId_idx" ON "EmailDispatch"("clientProposalId");

-- CreateIndex
CREATE INDEX "EmailDispatch_status_idx" ON "EmailDispatch"("status");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalDocument" ADD CONSTRAINT "ClientProposalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalDocument" ADD CONSTRAINT "ClientProposalDocument_clientProposalId_fkey" FOREIGN KEY ("clientProposalId") REFERENCES "ClientProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalDocument" ADD CONSTRAINT "ClientProposalDocument_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalEvent" ADD CONSTRAINT "ClientProposalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalEvent" ADD CONSTRAINT "ClientProposalEvent_clientProposalId_fkey" FOREIGN KEY ("clientProposalId") REFERENCES "ClientProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProposalEvent" ADD CONSTRAINT "ClientProposalEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BOQ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_clientProposalId_fkey" FOREIGN KEY ("clientProposalId") REFERENCES "ClientProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

