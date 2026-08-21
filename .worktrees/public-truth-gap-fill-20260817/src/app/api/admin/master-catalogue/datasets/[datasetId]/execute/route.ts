import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { listJobsForDataset, confirmExecution, processNextBatch } from "@/lib/services/master-catalogue-import-job-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const paramsSchema = z.object({ datasetId: z.string().min(1).max(128) });

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { datasetId } = paramsSchema.parse(await context.params);

    const jobs = await listJobsForDataset(actor, datasetId);
    if (jobs.length === 0) {
      return apiSuccess({ datasetId, status: "NO_JOB", message: "Run dry-run first to create a job." }, 409);
    }

    const latest = jobs[0];
    let jobId = latest.id;

    if (latest.status === "DRY_RUN_COMPLETE") {
      const confirmed = await confirmExecution(actor, latest.id);
      jobId = confirmed.id;
    }

    const progressed = await processNextBatch(actor, jobId);
    return apiSuccess(progressed);
  } catch (error) {
    return handleApiError(error);
  }
}
