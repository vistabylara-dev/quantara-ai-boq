import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { readSessionTokenFromCookies } from "@/lib/auth/session";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { applyVoiceBOQCommand } from "@/lib/services/voice-boq-command-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { voiceApplyRequestSchema } from "@/lib/voice/voice-types";
import { deriveVoiceProposalSigningKey } from "@/lib/voice/voice-proposal-token";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

/** The only voice route allowed to persist a change; requires the visible proposal's explicit confirmation. */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const proposalSigningKey = deriveVoiceProposalSigningKey(
      (await readSessionTokenFromCookies()) ?? "",
    );
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, voiceApplyRequestSchema);
    const data = await applyVoiceBOQCommand(actor, projectId, body, { proposalSigningKey });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
