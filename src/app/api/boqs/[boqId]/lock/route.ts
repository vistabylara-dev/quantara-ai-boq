import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getBOQRecord, lockBOQ } from "@/lib/repositories/boq-repository";
import { runBOQVerification } from "@/lib/repositories/verification-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

async function POSTHandler(_request: Request, context: { params: Promise<{ boqId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:lock");
    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);
    const current = await getBOQRecord(actor.companyId, boqId);
    if (!current.isLocked) {
      await runBOQVerification(actor.companyId, boqId);
    }
    const data = await lockBOQ(actor.companyId, boqId, actor.fullName, actor.userId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
