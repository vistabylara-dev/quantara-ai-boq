import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { processNextBatch } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";
// One bounded batch (job.batchSize rows, default 200) — this is deliberately
// short. If a batch is ever slow enough to approach this, batchSize should
// be tuned down, not this budget tuned up.
export const maxDuration = 60;

const paramsSchema = z.object({ jobId: z.string().uuid() });

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * CATALOGUE-PROD-ACTIVATE — processes exactly one bounded batch and returns.
 * The admin UI calls this repeatedly (while its tab stays open) to drive an
 * import to completion; closing the tab simply pauses at the last persisted
 * checkpoint — reopening the dataset page and clicking Continue resumes
 * from exactly there, never from zero.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { jobId } = paramsSchema.parse(await context.params);
    return apiSuccess(await processNextBatch(actor, jobId));
  } catch (error) {
    return handleApiError(error);
  }
}
