import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { updateImportMapping } from "@/lib/services/import-service";
import { importMappingUpdateSchema } from "@/lib/validation/phase7-schema";
import { importJobIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ importJobId: string }> };

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { importJobId } = importJobIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, importMappingUpdateSchema);
    const data = await updateImportMapping(actor, importJobId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = withActorRequestContext(PUTHandler);
