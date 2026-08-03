import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { recalculateBOQ } from "@/lib/repositories/boq-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);
    const data = await recalculateBOQ(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
