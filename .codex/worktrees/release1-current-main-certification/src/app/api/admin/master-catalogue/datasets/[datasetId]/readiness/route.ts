import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getDatasetReadinessDetail } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";
// Re-reads every file in the dataset off disk (up to ~50MB for the largest datasets) to verify
// checksum and row count — real I/O, given generous headroom over the platform default.
export const maxDuration = 60;

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

/**
 * CATALOGUE-ACTIVATE-2 — owner-only, strictly read-only. The full,
 * file-verifying readiness check for one dataset (existence, checksum, row
 * count, discipline/package/schema mapping) — deliberately separate from
 * the fast check baked into GET /api/admin/master-catalogue/datasets, so
 * that listing stays cheap and this heavier per-dataset check is only ever
 * run when explicitly requested. Never mutates anything, never creates an
 * import job/batch row.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);
    return apiSuccess(await getDatasetReadinessDetail(actor, datasetId));
  } catch (error) {
    return handleApiError(error);
  }
}
