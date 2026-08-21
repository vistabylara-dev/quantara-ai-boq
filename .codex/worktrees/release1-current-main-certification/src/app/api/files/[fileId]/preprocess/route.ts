import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { triggerFilePreprocessing } from "@/lib/services/drawing-page-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
/** Page rasterization + text extraction for a small QA-sized PDF completes in well under a second; 60s leaves generous headroom for larger real-world drawings without requesting more than this route needs. */
export const maxDuration = 60;

type RouteContext = { params: Promise<{ fileId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const data = await triggerFilePreprocessing(actor, fileId);
    return apiSuccess(data, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
