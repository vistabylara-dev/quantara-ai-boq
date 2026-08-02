import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { runBOQVerification } from "@/lib/repositories/verification-repository";
import { verificationBOQIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "verification:manage");
    const { boqId } = verificationBOQIdParamsSchema.parse(context.params);
    const data = await runBOQVerification(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
