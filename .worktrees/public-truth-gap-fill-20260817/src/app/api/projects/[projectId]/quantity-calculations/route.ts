import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { createCalculation, listCalculationsForProject } from "@/lib/services/quantity-calculation-service";
import { createCalculationSchema } from "@/lib/validation/quantity-calculation-schema";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const data = await listCalculationsForProject(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, createCalculationSchema);
    if (body.projectId !== projectId) {
      throw new AppError("PROJECT_ID_MISMATCH", "The request body's projectId must match the route.", 400);
    }
    const data = await createCalculation(actor, body);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
