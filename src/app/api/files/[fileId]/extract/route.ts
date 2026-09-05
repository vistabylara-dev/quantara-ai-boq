import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { triggerFileExtraction } from "@/lib/services/table-extraction-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";
/**
 * Real production drawing sets can contain large, vector-heavy PDFs. The
 * extraction worker is attached to this request with Next.js `after()`, so
 * its execution budget is this route's budget even though the 202 response
 * is returned immediately.
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
    return apiSuccess(data, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
