import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { createBOQRevision } from "@/lib/repositories/boq-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:lock");
    const { boqId } = boqIdParamsSchema.parse(context.params);
    const data = await createBOQRevision(actor.companyId, boqId, actor.fullName);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
