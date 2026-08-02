import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getImportJobForCompany } from "@/lib/services/import-service";
import { importJobIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { importJobId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { importJobId } = importJobIdParamsSchema.parse(context.params);
    const data = await getImportJobForCompany(actor, importJobId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
