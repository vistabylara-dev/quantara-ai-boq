import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { apiFailure, apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { AppError } from "@/lib/errors/app-error";
import { advanceTayqanWorkOrder } from "@/lib/services/tayqan-work-order-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { tayqanWorkOrderAdvanceSchema } from "@/lib/validation/tayqan-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * One advance pass can recover source jobs and run the governed senior-QS
 * measurement/draft pipeline. Keep the request alive long enough for the
 * existing 60-second extraction handlers and the AI review pass to persist a
 * durable result instead of abandoning a RUNNING lease at the platform's
 * default function limit.
 */
export const maxDuration = 300;

type RouteContext = { params: Promise<{ projectId: string }> };

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, tayqanWorkOrderAdvanceSchema);
    return apiSuccess(await advanceTayqanWorkOrder(actor, projectId, input.workOrderId));
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error("[TAYQAN-WORK-ORDER] measurement orchestration failed", error);
      return apiFailure(
        "TAYQAN_WORK_ORDER_UNEXPECTED_FAILURE",
        "TAYQAN could not complete this advance pass. Retry the same assignment; completed source, measurement and BOQ evidence remains preserved.",
        503,
      );
    }
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
