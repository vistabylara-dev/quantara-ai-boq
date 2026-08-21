-- CreateEnum
CREATE TYPE "IntegrationConnectionType" AS ENUM ('OAUTH_CLOUD', 'PLUGIN_DESKTOP', 'API_KEY', 'SERVICE_ACCOUNT', 'FILE_IMPORT', 'WEBHOOK', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "IntegrationProviderStatus" AS ENUM ('AVAILABLE', 'BETA', 'REQUIRES_PLUGIN', 'FILE_IMPORT_ONLY', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "ExternalConnectionStatus" AS ENUM ('CONNECTED', 'REAUTH_REQUIRED', 'SYNCING', 'DEGRADED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProjectIntegrationSyncState" AS ENUM ('NOT_SYNCED', 'QUEUED', 'SYNCING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SynchronizationRunResult" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL,
    "providerFamily" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "connectionType" "IntegrationConnectionType" NOT NULL,
    "status" "IntegrationProviderStatus" NOT NULL,
    "configurationMetadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConnection" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "connectedByUserId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "encryptedCredentialsRef" TEXT,
    "grantedScopesJson" JSONB,
    "providerAccountId" TEXT,
    "status" "ExternalConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectIntegration" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "externalConnectionId" UUID NOT NULL,
    "externalAccountId" TEXT,
    "externalProjectId" TEXT,
    "externalFolderId" TEXT,
    "externalFileId" TEXT,
    "externalModelId" TEXT,
    "externalVersionId" TEXT,
    "syncState" "ProjectIntegrationSyncState" NOT NULL DEFAULT 'NOT_SYNCED',
    "lastSyncedVersionId" TEXT,
    "syncSettingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynchronizationRun" (
    "id" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalConnectionId" UUID NOT NULL,
    "projectIntegrationId" UUID NOT NULL,
    "sourceVersionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" "SynchronizationRunResult",
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "actorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SynchronizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationProvider_providerFamily_idx" ON "IntegrationProvider"("providerFamily");

-- CreateIndex
CREATE INDEX "IntegrationProvider_category_idx" ON "IntegrationProvider"("category");

-- CreateIndex
CREATE INDEX "IntegrationProvider_status_idx" ON "IntegrationProvider"("status");

-- CreateIndex
CREATE INDEX "ExternalConnection_companyId_idx" ON "ExternalConnection"("companyId");

-- CreateIndex
CREATE INDEX "ExternalConnection_providerId_idx" ON "ExternalConnection"("providerId");

-- CreateIndex
CREATE INDEX "ExternalConnection_status_idx" ON "ExternalConnection"("status");

-- CreateIndex
CREATE INDEX "ProjectIntegration_projectId_idx" ON "ProjectIntegration"("projectId");

-- CreateIndex
CREATE INDEX "ProjectIntegration_externalConnectionId_idx" ON "ProjectIntegration"("externalConnectionId");

-- CreateIndex
CREATE INDEX "SynchronizationRun_projectIntegrationId_idx" ON "SynchronizationRun"("projectIntegrationId");

-- CreateIndex
CREATE INDEX "SynchronizationRun_externalConnectionId_idx" ON "SynchronizationRun"("externalConnectionId");

-- CreateIndex
CREATE INDEX "SynchronizationRun_providerId_idx" ON "SynchronizationRun"("providerId");

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIntegration" ADD CONSTRAINT "ProjectIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIntegration" ADD CONSTRAINT "ProjectIntegration_externalConnectionId_fkey" FOREIGN KEY ("externalConnectionId") REFERENCES "ExternalConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynchronizationRun" ADD CONSTRAINT "SynchronizationRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynchronizationRun" ADD CONSTRAINT "SynchronizationRun_externalConnectionId_fkey" FOREIGN KEY ("externalConnectionId") REFERENCES "ExternalConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynchronizationRun" ADD CONSTRAINT "SynchronizationRun_projectIntegrationId_fkey" FOREIGN KEY ("projectIntegrationId") REFERENCES "ProjectIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynchronizationRun" ADD CONSTRAINT "SynchronizationRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
