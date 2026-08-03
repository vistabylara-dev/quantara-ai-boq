import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { confirmFinding } from "@/lib/services/finding-service";
import { findingIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { findingId: string } };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { findingId } = findingIdParamsSchema.parse(context.params);
    const data = await confirmFinding(actor, findingId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
