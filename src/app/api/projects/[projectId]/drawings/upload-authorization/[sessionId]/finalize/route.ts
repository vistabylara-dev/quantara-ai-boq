import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { finalizeDrawingUpload } from "@/lib/services/drawing-service";
import { drawingMetadataSchema } from "@/lib/validation/drawing-schema";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string; sessionId: string }> };

const paramsSchema = projectIdParamsSchema.extend({ sessionId: z.string().uuid("A valid session ID is required.") });
const finalizeRequestSchema = z.object({ metadata: drawingMetadataSchema.optional().default({}) }).strict();

/**
 * Step 2 of the direct-upload flow — called by the browser only after its
 * direct PUT to Blob succeeds. Never accepts a caller-supplied Blob URL;
 * the exact pathname is looked up server-side from the session this
 * sessionId identifies, scoped to the authenticated actor's own company.
 */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId, sessionId } = paramsSchema.parse(await context.params);
    const { metadata } = await parseJsonBody(request, finalizeRequestSchema);
    const result = await finalizeDrawingUpload(actor, projectId, { sessionId, metadata });
    return apiSuccess(result, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
