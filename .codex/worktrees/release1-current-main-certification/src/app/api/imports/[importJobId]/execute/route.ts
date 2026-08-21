import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { executeImportJob } from "@/lib/services/import-service";
import { importJobIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ importJobId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { importJobId } = importJobIdParamsSchema.parse(params);
    const data = await executeImportJob(actor, importJobId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
