import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { triggerFileExtraction } from "@/lib/services/table-extraction-service";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
/**
 * Real production drawing sets can contain large, vector-heavy PDFs. The
 * Keep the worker inside this invocation. The queue still schedules its
 * normal `after()` callback, but processQueuedJob() claims QUEUED -> RUNNING
 * atomically, so this direct call and the callback cannot execute the same
 * job twice. Awaiting the claim also prevents a successful 202 from leaving
 * a permanently QUEUED job when a platform drops the post-response callback.
 */
export const maxDuration = 300;

type RouteContext = { params: Promise<{ fileId: string }> };

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const data = await triggerFileExtraction(actor, fileId);
    await extractionJobQueue.processQueuedJob(actor.companyId, data.id);
    return apiSuccess(data, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
