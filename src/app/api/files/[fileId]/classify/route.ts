import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { triggerFileClassification } from "@/lib/services/project-file-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
/** Document classification is a lightweight heuristic pass, not a heavy operation; 60s leaves generous headroom. */
export const maxDuration = 60;

type RouteContext = { params: Promise<{ fileId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const data = await triggerFileClassification(actor, fileId);
    return apiSuccess(data, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
