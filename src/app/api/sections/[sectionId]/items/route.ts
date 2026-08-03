import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createBOQItem,
  type BOQItemWriteInput,
} from "@/lib/repositories/boq-repository";
import {
  itemCreateRouteSchema,
  sectionIdParamsSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ sectionId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { sectionId } = sectionIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, itemCreateRouteSchema) as BOQItemWriteInput;
    const data = await createBOQItem(actor.companyId, sectionId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
