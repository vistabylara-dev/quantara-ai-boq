import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { confirmBOQItemIntegrity } from "@/lib/repositories/boq-repository";
import { itemIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

async function POSTHandler(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const { itemId } = itemIdParamsSchema.parse(await context.params);
    const boq = await confirmBOQItemIntegrity(actor.companyId, itemId, {
      userId: actor.userId,
      name: actor.fullName,
    });
    return apiSuccess(boq);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
