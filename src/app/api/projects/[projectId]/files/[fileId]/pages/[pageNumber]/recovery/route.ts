import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getPageRecoveryState } from "@/lib/services/table-page-recovery-service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  projectId: z.string().trim().min(1),
  fileId: z.string().uuid(),
  pageNumber: z.coerce.number().int().min(1),
});

type RouteContext = { params: Promise<{ projectId: string; fileId: string; pageNumber: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, fileId, pageNumber } = paramsSchema.parse(await context.params);
    const data = await getPageRecoveryState(actor, projectId, fileId, pageNumber);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
