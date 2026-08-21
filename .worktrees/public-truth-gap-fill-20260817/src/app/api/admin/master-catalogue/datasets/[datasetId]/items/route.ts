import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { inspectDatasetProductionItems } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

/**
 * CATALOGUE-COMMERCIAL Checkpoint 1A — read-only. Lists the current
 * production MasterItem rows for a registered dataset's discipline with
 * their raw provenance (sourceBatchId / createdAt), so the platform owner
 * can see whether existing items came from this dataset's governed
 * pipeline or from somewhere else, before approving an execute. Never
 * mutates anything.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);
    return apiSuccess(await inspectDatasetProductionItems(actor, datasetId));
  } catch (error) {
    return handleApiError(error);
  }
}
