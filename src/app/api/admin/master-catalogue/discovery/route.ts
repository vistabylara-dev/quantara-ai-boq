import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { discoverCatalogueDatasets } from "@/lib/services/catalogue-discovery-service";

export const dynamic = "force-dynamic";
// Streams and checksums every registered-catalogue CSV in the repo (53 files, ~118MB total as of
// this writing) — comfortably fast, but generous headroom over the platform default since this
// reads every byte of every approved dataset file.
export const maxDuration = 120;

/**
 * CATALOGUE-DISCOVERY — owner-only, strictly read-only. Never writes to the
 * database, never mutates catalogue data. Walks data-imports/**, streams
 * and classifies every CSV against the MasterDiscipline rows that actually
 * exist today, and returns the full discovery report so the platform
 * owner can decide what to register/import next.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const disciplines = await prisma.masterDiscipline.findMany({ select: { key: true } });
    const knownDisciplineKeys = new Set(disciplines.map((d) => d.key));
    const folders = await discoverCatalogueDatasets("data-imports", knownDisciplineKeys);

    const summary = {
      totalFolders: folders.length,
      totalFiles: folders.reduce((sum, f) => sum + f.totalFileCount, 0),
      totalBytes: folders.reduce((sum, f) => sum + f.totalByteSize, 0),
      totalRows: folders.reduce((sum, f) => sum + f.totalRowCount, 0),
      autoValidated: folders.filter((f) => f.confidence === "AUTO_VALIDATED").length,
      validatedWithWarnings: folders.filter((f) => f.confidence === "VALIDATED_WITH_WARNINGS").length,
      needsOwnerReview: folders.filter((f) => f.confidence === "NEEDS_OWNER_REVIEW").length,
      rejected: folders.filter((f) => f.confidence === "REJECTED").length,
      knownDisciplineKeys: Array.from(knownDisciplineKeys).sort(),
    };

    return apiSuccess({ summary, folders });
  } catch (error) {
    return handleApiError(error);
  }
}
