import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createProjectBOQ,
  listProjectBOQs,
} from "@/lib/repositories/boq-repository";
import {
  projectBOQCreateSchema,
  projectIdParamsSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const data = await listProjectBOQs(actor.companyId, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const input = request.body === null
      ? undefined
      : await parseJsonBody(request, projectBOQCreateSchema);
    const data = await createProjectBOQ(actor.companyId, projectId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
