import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { readSessionTokenFromCookies } from "@/lib/auth/session";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { proposeVoiceCommand } from "@/lib/services/voice-boq-command-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";
import { voiceProposeRequestSchema } from "@/lib/voice/voice-types";
import { deriveVoiceProposalSigningKey } from "@/lib/voice/voice-proposal-token";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

/** Read-only: resolves current context and returns an old-to-new proposal only. */
export async function POST(request: Request, context: RouteContext) {
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
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
