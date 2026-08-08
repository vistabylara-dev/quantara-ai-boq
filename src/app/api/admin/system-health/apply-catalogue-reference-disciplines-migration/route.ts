import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { applyCatalogueReferenceDisciplinesMigration } from "@/lib/services/catalogue-reference-disciplines-migration-service";

export const dynamic = "force-dynamic";

/**
 * CATALOGUE-INTEGRITY-REPAIR — owner-only, idempotent apply of migration
 * 20260808120000_add_catalogue_reference_disciplines (the interior-fit-out
 * and landscaping MasterDiscipline rows that data-imports/architectural-finishes
 * and data-imports/landscaping require — see that migration's own comment
 * for why production never got them). Purely additive, never overwrites an
 * existing row. Same break-glass pattern as every prior production
 * migration endpoint this project has used — runs inside this deployment
 * using its real runtime DATABASE_URL. No arbitrary migration name or SQL
 * is ever accepted from the caller; this route applies exactly one fixed,
 * reviewed migration and nothing else. The actual upsert/record logic lives
 * in catalogue-reference-disciplines-migration-service.ts so it can be
 * exercised directly in tests without going through HTTP/auth.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const result = await applyCatalogueReferenceDisciplinesMigration();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
