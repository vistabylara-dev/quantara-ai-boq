import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { recalculateBOQ } from "@/lib/repositories/boq-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:edit");
    const { boqId } = boqIdParamsSchema.parse(context.params);
    const data = await recalculateBOQ(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
