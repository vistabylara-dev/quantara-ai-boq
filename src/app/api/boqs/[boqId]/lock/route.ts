import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getBOQRecord, lockBOQ } from "@/lib/repositories/boq-repository";
import { runBOQVerification } from "@/lib/repositories/verification-repository";
import { boqIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:lock");
    const { boqId } = boqIdParamsSchema.parse(context.params);
    const current = await getBOQRecord(actor.companyId, boqId);
    if (!current.isLocked) {
      await runBOQVerification(actor.companyId, boqId);
    }
    const data = await lockBOQ(actor.companyId, boqId, actor.fullName);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
