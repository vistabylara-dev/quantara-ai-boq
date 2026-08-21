import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { duplicateBOQItem } from "@/lib/repositories/boq-repository";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { itemId } = itemIdParamsSchema.parse(params);
    const data = await duplicateBOQItem(actor.companyId, itemId);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
