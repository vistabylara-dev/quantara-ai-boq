import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getTayqanWorkspaceState } from "@/lib/services/tayqan-hire-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const url = new URL(request.url);
    const preferredBoqId = url.searchParams.get("boqId");
    return apiSuccess(
      await getTayqanWorkspaceState(actor, projectId, preferredBoqId),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
