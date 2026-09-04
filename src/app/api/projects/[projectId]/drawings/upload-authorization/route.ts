import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { authorizeDrawingUpload, listRecoverableDrawingUploads } from "@/lib/services/drawing-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

const authorizationRequestSchema = z
  .object({
    originalName: z.string().trim().min(1).max(255),
    declaredMimeType: z.string().trim().min(1).max(255),
    declaredByteSize: z.number().int().positive(),
  })
  .strict();

/**
 * Step 1 of the direct-upload flow. Never receives file bytes — only
 * declared metadata about a file the browser intends to upload directly to
 * Blob afterward. Returns a scoped, short-lived upload token and the
 * server-generated pathname it is valid for; never a Blob secret, never a
 * browser-influenced storage path.
 */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = await parseJsonBody(request, authorizationRequestSchema);
    const result = await authorizeDrawingUpload(actor, projectId, input);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    return apiSuccess(await listRecoverableDrawingUploads(actor, projectId));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
