import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { startOrResumeTayqanWorkOrder } from "@/lib/services/tayqan-work-order-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { tayqanStartSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required to start TAYQAN work.", 400);
    }
    const input = await parseJsonBody(request, tayqanStartSchema);
    return apiSuccess(
      await startOrResumeTayqanWorkOrder(actor, projectId, input.sessionId, idempotencyKey),
      202,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
