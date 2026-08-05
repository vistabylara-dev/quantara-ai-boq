import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * CORE-FLOW-1 — owner-only, idempotent apply of migration
 * 20260805100000_core_flow_1_upload_session (the ProjectFileUploadSession
 * table + its enum). Purely additive. Same break-glass pattern as every
 * prior production migration endpoint this project has used — runs inside
 * this deployment using its real runtime DATABASE_URL. Every raw identifier
 * column read is cast to ::text — Postgres's internal `name` type otherwise
 * fails Prisma's $queryRaw deserializer (P2010), as found during
 * STRIPE-1B-RECOVERY and now applied consistently from the start here.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const log: string[] = [];
    const MIGRATION_NAME = "20260805100000_core_flow_1_upload_session";
    const CHECKSUM = "56e9d54c5e7ba4684039b0ab734a5f38c0e2d084f1ae875c42477677dd03a149";

    const alreadyRecorded = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
    `;
    if (alreadyRecorded.length > 0) {
      return apiSuccess({ alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] });
    }

    await prisma.$transaction(async (tx) => {
      const existingTypes = await tx.$queryRaw<{ typname: string }[]>`
        SELECT typname::text AS typname FROM pg_type WHERE typname = 'ProjectFileUploadSessionStatus'
      `;
      if (existingTypes.length === 0) {
        await tx.$executeRaw`CREATE TYPE "ProjectFileUploadSessionStatus" AS ENUM ('PENDING', 'FINALIZED', 'EXPIRED', 'CANCELLED')`;
        log.push("Created enum ProjectFileUploadSessionStatus.");
      } else {
        log.push("Enum ProjectFileUploadSessionStatus already exists — skipped.");
      }

      const tables = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_name = 'ProjectFileUploadSession'
      `;
      if (tables.length === 0) {
        await tx.$executeRaw`
          CREATE TABLE "ProjectFileUploadSession" (
            "id" UUID NOT NULL,
            "companyId" UUID NOT NULL,
            "projectId" UUID NOT NULL,
            "actorUserId" UUID NOT NULL,
            "fileId" UUID NOT NULL,
            "storageKey" TEXT NOT NULL,
            "originalName" TEXT NOT NULL,
            "declaredMimeType" TEXT NOT NULL,
            "declaredByteSize" INTEGER NOT NULL,
            "extension" TEXT NOT NULL,
            "status" "ProjectFileUploadSessionStatus" NOT NULL DEFAULT 'PENDING',
            "finalizedAt" TIMESTAMP(3),
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "ProjectFileUploadSession_pkey" PRIMARY KEY ("id")
          )
        `;
        log.push("Created table ProjectFileUploadSession.");
      } else {
        log.push("Table ProjectFileUploadSession already exists — skipped.");
      }

      const existingIndexes = await tx.$queryRaw<{ indexname: string }[]>`
        SELECT indexname::text AS indexname FROM pg_indexes WHERE tablename = 'ProjectFileUploadSession'
      `;
      const indexNames = new Set(existingIndexes.map((i) => i.indexname));

      const indexStatements: Array<{ name: string; sql: () => Promise<unknown> }> = [
        { name: "ProjectFileUploadSession_storageKey_key", sql: () => tx.$executeRaw`CREATE UNIQUE INDEX "ProjectFileUploadSession_storageKey_key" ON "ProjectFileUploadSession"("storageKey")` },
        { name: "ProjectFileUploadSession_companyId_idx", sql: () => tx.$executeRaw`CREATE INDEX "ProjectFileUploadSession_companyId_idx" ON "ProjectFileUploadSession"("companyId")` },
        { name: "ProjectFileUploadSession_projectId_idx", sql: () => tx.$executeRaw`CREATE INDEX "ProjectFileUploadSession_projectId_idx" ON "ProjectFileUploadSession"("projectId")` },
        { name: "ProjectFileUploadSession_expiresAt_idx", sql: () => tx.$executeRaw`CREATE INDEX "ProjectFileUploadSession_expiresAt_idx" ON "ProjectFileUploadSession"("expiresAt")` },
        { name: "ProjectFileUploadSession_status_idx", sql: () => tx.$executeRaw`CREATE INDEX "ProjectFileUploadSession_status_idx" ON "ProjectFileUploadSession"("status")` },
      ];
      for (const stmt of indexStatements) {
        if (!indexNames.has(stmt.name)) {
          await stmt.sql();
          log.push(`Created index ${stmt.name}.`);
        }
      }

      const existingConstraints = await tx.$queryRaw<{ conname: string }[]>`
        SELECT conname::text AS conname FROM pg_constraint WHERE conname IN
          ('ProjectFileUploadSession_companyId_fkey', 'ProjectFileUploadSession_projectId_fkey', 'ProjectFileUploadSession_actorUserId_fkey')
      `;
      const constraintNames = new Set(existingConstraints.map((c) => c.conname));

      if (!constraintNames.has("ProjectFileUploadSession_companyId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key ProjectFileUploadSession_companyId_fkey.");
      }
      if (!constraintNames.has("ProjectFileUploadSession_projectId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key ProjectFileUploadSession_projectId_fkey.");
      }
      if (!constraintNames.has("ProjectFileUploadSession_actorUserId_fkey")) {
        await tx.$executeRaw`ALTER TABLE "ProjectFileUploadSession" ADD CONSTRAINT "ProjectFileUploadSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        log.push("Added foreign key ProjectFileUploadSession_actorUserId_fkey.");
      }

      await tx.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
        VALUES (gen_random_uuid()::text, ${CHECKSUM}, ${MIGRATION_NAME}, now(), now(), 1)
      `;
      log.push(`Recorded ${MIGRATION_NAME} as applied in _prisma_migrations.`);
    });

    return apiSuccess({ alreadyApplied: false, log });
  } catch (error) {
    return handleApiError(error);
  }
}
