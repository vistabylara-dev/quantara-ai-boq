import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { getBOQVerification } from "@/lib/repositories/verification-repository";
import { verificationBOQIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    const { boqId } = verificationBOQIdParamsSchema.parse(context.params);
    const data = await getBOQVerification(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
