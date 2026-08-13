import { z } from "zod";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { generateAutodeskDwgCandidates } from "@/lib/services/autodesk-candidate-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

// The browser selects only server-verifiable Autodesk resource IDs. It cannot
// submit a token, derivative URN, company ID, quantity, or BOQ content.
const extractBodySchema = z.object({
  autodeskProjectId: z.string().trim().min(1).max(2_000),
  itemId: z.string().trim().min(1).max(2_000),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const body = await parseJsonBody(request, extractBodySchema);
    const data = await generateAutodeskDwgCandidates(actor, { projectId, ...body });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
