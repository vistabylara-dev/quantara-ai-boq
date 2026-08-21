-- CreateEnum
CREATE TYPE "IntegrationEventType" AS ENUM ('CONNECTION_CREATED', 'CONNECTION_REFRESHED', 'CONNECTION_REAUTH_REQUIRED', 'CONNECTION_DISCONNECTED', 'CONNECTION_ERROR', 'PROJECT_LINKED', 'PROJECT_UNLINKED', 'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED');

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalConnectionId" UUID,
    "projectIntegrationId" UUID,
    "eventType" "IntegrationEventType" NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadataJson" JSONB,
    "actorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationEvent_companyId_createdAt_idx" ON "IntegrationEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_externalConnectionId_idx" ON "IntegrationEvent"("externalConnectionId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_projectIntegrationId_idx" ON "IntegrationEvent"("projectIntegrationId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_eventType_idx" ON "IntegrationEvent"("eventType");

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_externalConnectionId_fkey" FOREIGN KEY ("externalConnectionId") REFERENCES "ExternalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_projectIntegrationId_fkey" FOREIGN KEY ("projectIntegrationId") REFERENCES "ProjectIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
