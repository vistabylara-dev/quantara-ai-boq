import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getTayqanWorkOrderState } from "@/lib/services/tayqan-work-order-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) throw new AppError("TAYQAN_SESSION_REQUIRED", "sessionId is required.", 400);
    return apiSuccess(await getTayqanWorkOrderState(actor, projectId, sessionId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
