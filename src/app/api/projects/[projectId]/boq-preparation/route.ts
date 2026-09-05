import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import {
  autonomousBoqPreparationRequestSchema,
  getAutonomousBoqPreparation,
  startAutonomousBoqPreparation,
} from "@/lib/services/autonomous-boq-preparation-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { extractionJobQueue } from "@/lib/jobs/extraction-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    return apiSuccess(await getAutonomousBoqPreparation(actor, projectId));
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, autonomousBoqPreparationRequestSchema);
    const preparation = await startAutonomousBoqPreparation(actor, projectId, input);
    await extractionJobQueue.processQueuedJob(actor.companyId, preparation.id);
    return apiSuccess(preparation, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
