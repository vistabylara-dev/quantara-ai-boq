import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { reviewExistingBOQ } from "@/lib/services/worker-review-service";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const { boqId } = boqIdParamsSchema.parse(await context.params);
    return apiSuccess(await reviewExistingBOQ(actor, boqId));
  } catch (error) {
    return handleApiError(error);
  }
}
