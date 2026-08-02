import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { resolveVerificationException } from "@/lib/repositories/verification-repository";
import { verificationResolutionSchema } from "@/lib/validation/backend-schemas";
import { verificationExceptionIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: { exceptionId: string } }) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "verification:manage");
    const { exceptionId } = verificationExceptionIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, verificationResolutionSchema);
    const data = await resolveVerificationException(
      actor.companyId,
      exceptionId,
      input.resolutionNote,
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
