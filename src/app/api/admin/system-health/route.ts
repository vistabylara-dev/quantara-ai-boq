import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * PRODUCTION-RECOVERY-1 — owner-only, read-only diagnostic. Exists because the
 * platform owner cannot retrieve DATABASE_URL from Vercel (it's stored
 * Encrypted/write-only) and no local process can reach the production
 * database directly. This route runs inside production, where the real
 * connection already exists at runtime, and reports only safe structural
 * facts: which migrations Prisma's own tracking table has recorded, and
 * coarse row counts for a handful of core tables — never schema contents,
 * never credentials, never a connection string.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; applied_steps_count: number }[]>`
      SELECT migration_name, finished_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at ASC
    `;

    const [companyCount, userCount, projectCount, boqCount, masterItemCount, documentTemplateCount, generatedDocumentCount] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.bOQ.count(),
      prisma.masterItem.count(),
      prisma.documentTemplate.count(),
      prisma.generatedDocument.count(),
    ]);

    return apiSuccess({
      migrationsApplied: migrations.length,
      migrationNames: migrations.map((m) => m.migration_name),
      unfinishedMigrations: migrations.filter((m) => !m.finished_at).map((m) => m.migration_name),
      rowCounts: {
        Company: companyCount,
        User: userCount,
        Project: projectCount,
        BOQ: boqCount,
        MasterItem: masterItemCount,
        DocumentTemplate: documentTemplateCount,
        GeneratedDocument: generatedDocumentCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
