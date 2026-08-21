import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listJobsForDataset } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

/** CATALOGUE-PROD-ACTIVATE — batch/job history for a dataset (most recent 25). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);
    return apiSuccess(await listJobsForDataset(actor, datasetId));
  } catch (error) {
    return handleApiError(error);
  }
}
