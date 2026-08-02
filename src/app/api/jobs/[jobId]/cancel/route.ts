import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { cancelExtractionJob } from "@/lib/services/extraction-job-service";
import { extractionJobIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { jobId: string } };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { jobId } = extractionJobIdParamsSchema.parse(context.params);
    const data = await cancelExtractionJob(actor, jobId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
