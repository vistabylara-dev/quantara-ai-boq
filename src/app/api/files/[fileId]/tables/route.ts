import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listExtractedTablesForFile } from "@/lib/services/table-extraction-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { fileId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { fileId } = projectFileIdParamsSchema.parse(context.params);
    const data = await listExtractedTablesForFile(actor, fileId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
