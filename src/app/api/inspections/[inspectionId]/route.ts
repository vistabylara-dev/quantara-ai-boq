import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getInspectionRecord } from "@/lib/services/inspection-service";
import { inspectionIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { inspectionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { inspectionId } = inspectionIdParamsSchema.parse(context.params);
    const data = await getInspectionRecord(actor, inspectionId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
