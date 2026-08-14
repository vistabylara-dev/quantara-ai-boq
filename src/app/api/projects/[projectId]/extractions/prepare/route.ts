import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { prepareStructuredSourceCandidates } from "@/lib/services/source-candidate-bridge-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

const prepareBodySchema = z.object({
  projectFileId: z.string().uuid().optional(),
}).strict();

/**
 * Backfill for projects with tables extracted before the structured-source candidate bridge
 * existed. Never re-reads/reprocesses the source file — generates NEEDS_REVIEW candidates from
 * already-stored ExtractedTable/Row/Cell rows only. No BOQ mutation, no confirmation.
 */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, prepareBodySchema);
    const data = await prepareStructuredSourceCandidates(actor, { projectId, projectFileId: body.projectFileId });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
