import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { actOnImportRows } from "@/lib/services/import-service";
import { importRowActionSchema } from "@/lib/validation/phase7-schema";
import { importJobIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ importJobId: string }> };

/** Reviews (approves/skips/rejects) specific rows — a row must be approved here before execute will ever touch it. */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { importJobId } = importJobIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, importRowActionSchema);
    const data = await actOnImportRows(actor, importJobId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
