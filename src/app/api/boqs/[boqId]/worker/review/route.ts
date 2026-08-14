import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { enqueueWorkerReview } from "@/lib/services/worker-runner-service";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for durable worker reviews.", 400);
    }
    return apiSuccess(await enqueueWorkerReview(actor, boqId, idempotencyKey), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
