import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * PRODUCTION-RECOVERY-1 — owner-only, one-time, idempotent apply of the two
 * specific migrations found missing by /api/admin/system-health during this
 * audit: 20260804150000_catalogue_prod_activate_import_jobs (partially
 * applied — type/table/indexes existed, the 3 foreign keys did not) and
 * 20260804220000_template_link_1_versioning (fully missing). Both migration
 * files are additive-only (verified: zero DROP statements). Runs inside
 * this deployment, using the real runtime DATABASE_URL neither the owner
 * nor any local process can read directly.
 *
 * Idempotent by design: every step checks current state before acting, so a
 * retried or partial-failure call never double-creates an object or fails
 * on "already exists". Not wired into any UI, never linked from anywhere —
 * a deliberate one-time break-glass tool the owner opens directly by URL.
 * GET (not POST) so it's reachable by pasting the URL in a browser; the
 * idempotency guard is what makes that safe despite being a mutating
 * endpoint — a same-origin prefetch or an accidental repeat visit only
 * re-confirms already-applied state rather than risking a double-apply.
 */
export async function GET() {
  try {
    const owner = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const log: string[] = [];

    const alreadyApplied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name IN ('20260804150000_catalogue_prod_activate_import_jobs', '20260804220000_template_link_1_versioning')
    `;
    const appliedNames = new Set(alreadyApplied.map((r) => r.migration_name));

    // --- Migration 27: catalogue_prod_activate_import_jobs ---
    if (appliedNames.has("20260804150000_catalogue_prod_activate_import_jobs")) {
      log.push("catalogue_prod_activate_import_jobs: already recorded as applied, skipped.");
    } else {
      const existingConstraints = await prisma.$queryRaw<{ conname: string }[]>`
        SELECT conname::text FROM pg_constraint WHERE conrelid = '"MasterCatalogueImportJob"'::regclass
      `;
      const haveConstraints = new Set(existingConstraints.map((c) => c.conname));

      await prisma.$transaction(async (tx) => {
        if (!haveConstraints.has("MasterCatalogueImportJob_actorUserId_fkey")) {
          await tx.$executeRawUnsafe(`ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        }
        if (!haveConstraints.has("MasterCatalogueImportJob_disciplineId_fkey")) {
          await tx.$executeRawUnsafe(`ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
        }
        if (!haveConstraints.has("MasterCatalogueImportJob_legacyBatchId_fkey")) {
          await tx.$executeRawUnsafe(`ALTER TABLE "MasterCatalogueImportJob" ADD CONSTRAINT "MasterCatalogueImportJob_legacyBatchId_fkey" FOREIGN KEY ("legacyBatchId") REFERENCES "MasterCatalogueImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
           VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
          "b3407a2eb4979b03218d23e9dcb13d387d416a5a34f1867c43b5430eb40a3a3b",
          "20260804150000_catalogue_prod_activate_import_jobs",
        );
      });
      log.push("catalogue_prod_activate_import_jobs: added missing foreign keys and recorded as applied.");
    }

    // --- Migration 28: template_link_1_versioning ---
    if (appliedNames.has("20260804220000_template_link_1_versioning")) {
      log.push("template_link_1_versioning: already recorded as applied, skipped.");
    } else {
      const tableExists = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name::text FROM information_schema.tables WHERE table_name = 'DocumentTemplateVersion'
      `;
      if (tableExists.length > 0) {
        log.push("template_link_1_versioning: DocumentTemplateVersion already exists but was unrecorded — recording only, no DDL run.");
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
           VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
          "7b5621434d87f66adb73f7af146cd7206d380268df0c17996811e07ce184b749",
          "20260804220000_template_link_1_versioning",
        );
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED')`);
          await tx.$executeRawUnsafe(`ALTER TABLE "EmailDispatch" ADD COLUMN "emailTemplateVersionId" UUID`);
          await tx.$executeRawUnsafe(`ALTER TABLE "GeneratedDocument" ADD COLUMN "templateVersionId" UUID`);
          await tx.$executeRawUnsafe(`ALTER TABLE "GeneratedTechnicalReport" ADD COLUMN "templateVersionId" UUID`);
          await tx.$executeRawUnsafe(`CREATE TABLE "DocumentTemplateVersion" (
            "id" UUID NOT NULL,
            "documentTemplateId" UUID NOT NULL,
            "versionNumber" INTEGER NOT NULL,
            "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
            "styleConfigJson" JSONB NOT NULL,
            "contentConfigJson" JSONB NOT NULL,
            "changeSummary" TEXT NOT NULL DEFAULT '',
            "effectiveDate" TIMESTAMP(3),
            "retiredDate" TIMESTAMP(3),
            "createdByUserId" UUID,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
          )`);
          await tx.$executeRawUnsafe(`CREATE TABLE "TechnicalReportTemplateVersion" (
            "id" UUID NOT NULL,
            "technicalReportTemplateId" UUID NOT NULL,
            "versionNumber" INTEGER NOT NULL,
            "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
            "sectionsJson" JSONB NOT NULL,
            "changeSummary" TEXT NOT NULL DEFAULT '',
            "effectiveDate" TIMESTAMP(3),
            "retiredDate" TIMESTAMP(3),
            "createdByUserId" UUID,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "TechnicalReportTemplateVersion_pkey" PRIMARY KEY ("id")
          )`);
          await tx.$executeRawUnsafe(`CREATE TABLE "EmailTemplateVersion" (
            "id" UUID NOT NULL,
            "emailTemplateId" UUID NOT NULL,
            "versionNumber" INTEGER NOT NULL,
            "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
            "subject" TEXT NOT NULL,
            "bodyHtml" TEXT NOT NULL,
            "bodyText" TEXT NOT NULL,
            "changeSummary" TEXT NOT NULL DEFAULT '',
            "effectiveDate" TIMESTAMP(3),
            "retiredDate" TIMESTAMP(3),
            "createdByUserId" UUID,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
          )`);
          await tx.$executeRawUnsafe(`CREATE INDEX "DocumentTemplateVersion_documentTemplateId_idx" ON "DocumentTemplateVersion"("documentTemplateId")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "DocumentTemplateVersion_status_idx" ON "DocumentTemplateVersion"("status")`);
          await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "DocumentTemplateVersion_documentTemplateId_versionNumber_key" ON "DocumentTemplateVersion"("documentTemplateId", "versionNumber")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "TechnicalReportTemplateVersion_technicalReportTemplateId_idx" ON "TechnicalReportTemplateVersion"("technicalReportTemplateId")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "TechnicalReportTemplateVersion_status_idx" ON "TechnicalReportTemplateVersion"("status")`);
          await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "TechnicalReportTemplateVersion_technicalReportTemplateId_ve_key" ON "TechnicalReportTemplateVersion"("technicalReportTemplateId", "versionNumber")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "EmailTemplateVersion_emailTemplateId_idx" ON "EmailTemplateVersion"("emailTemplateId")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "EmailTemplateVersion_status_idx" ON "EmailTemplateVersion"("status")`);
          await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "EmailTemplateVersion_emailTemplateId_versionNumber_key" ON "EmailTemplateVersion"("emailTemplateId", "versionNumber")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "EmailDispatch_emailTemplateVersionId_idx" ON "EmailDispatch"("emailTemplateVersionId")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "GeneratedDocument_templateVersionId_idx" ON "GeneratedDocument"("templateVersionId")`);
          await tx.$executeRawUnsafe(`CREATE INDEX "GeneratedTechnicalReport_templateVersionId_idx" ON "GeneratedTechnicalReport"("templateVersionId")`);
          await tx.$executeRawUnsafe(`ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "TechnicalReportTemplateVersion" ADD CONSTRAINT "TechnicalReportTemplateVersion_technicalReportTemplateId_fkey" FOREIGN KEY ("technicalReportTemplateId") REFERENCES "TechnicalReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "TechnicalReportTemplateVersion" ADD CONSTRAINT "TechnicalReportTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "GeneratedTechnicalReport" ADD CONSTRAINT "GeneratedTechnicalReport_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TechnicalReportTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(`ALTER TABLE "EmailDispatch" ADD CONSTRAINT "EmailDispatch_emailTemplateVersionId_fkey" FOREIGN KEY ("emailTemplateVersionId") REFERENCES "EmailTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
          await tx.$executeRawUnsafe(
            `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
             VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
            "7b5621434d87f66adb73f7af146cd7206d380268df0c17996811e07ce184b749",
            "20260804220000_template_link_1_versioning",
          );
        });
        log.push("template_link_1_versioning: created all tables/indexes/constraints and recorded as applied.");
      }
    }

    const finalCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM "_prisma_migrations"`;

    return apiSuccess({
      appliedBy: owner.email,
      log,
      totalMigrationsNowRecorded: Number(finalCount[0].count),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
