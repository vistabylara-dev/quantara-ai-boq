import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { resolveVerificationException } from "@/lib/repositories/verification-repository";
import { verificationResolutionSchema } from "@/lib/validation/backend-schemas";
import { verificationExceptionIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request, context: { params: Promise<{ exceptionId: string }> }) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "verification:manage");
    const params = await context.params;
    const { exceptionId } = verificationExceptionIdParamsSchema.parse(params);
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

export const POST = withActorRequestContext(POSTHandler);
