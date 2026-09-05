import { z } from "zod";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { retryAutonomousBoqPreparation } from "@/lib/services/autonomous-boq-preparation-service";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const paramsSchema = z.object({
  projectId: z.string().trim().min(1),
  jobId: z.string().uuid(),
}).strict();

type RouteContext = { params: Promise<{ projectId: string; jobId: string }> };

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, jobId } = paramsSchema.parse(await context.params);
    const preparation = await retryAutonomousBoqPreparation(actor, projectId, jobId);
    await extractionJobQueue.processQueuedJob(actor.companyId, preparation.id);
    return apiSuccess(preparation, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
