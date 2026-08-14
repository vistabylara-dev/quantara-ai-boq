import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { readSessionTokenFromCookies } from "@/lib/auth/session";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { proposeVoiceCommand } from "@/lib/services/voice-boq-command-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { voiceProposeRequestSchema } from "@/lib/voice/voice-types";
import { deriveVoiceProposalSigningKey } from "@/lib/voice/voice-proposal-token";
import { createOpenAIVoiceCommandInterpreter } from "@/lib/voice/openai-command-interpreter";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

/** Read-only: resolves current context and returns an old-to-new proposal only. */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const proposalSigningKey = deriveVoiceProposalSigningKey(
      (await readSessionTokenFromCookies()) ?? "",
    );
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, voiceProposeRequestSchema);
    const data = await proposeVoiceCommand(actor, projectId, body.transcript, body.context, {
      proposalSigningKey,
      interpreter: createOpenAIVoiceCommandInterpreter(),
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
