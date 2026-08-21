import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { AppError } from "@/lib/errors/app-error";
import { updateFileClassification } from "@/lib/services/project-file-service";
import { projectFileIdParamsSchema } from "@/lib/validation/route-params";
import { confirmOrReclassifyBodySchema } from "@/lib/validation/project-file-schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ fileId: string }> };

/** Human confirm-or-change action: omit `classification` in the body (or send an empty body) to confirm the current suggestion as-is, or provide one to reclassify. */
async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { fileId } = projectFileIdParamsSchema.parse(params);
    const rawBody = await request.text();
    let parsedBody: unknown = {};
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        throw new AppError("INVALID_JSON", "The request body must contain valid JSON.", 400);
      }
    }
    const body = confirmOrReclassifyBodySchema.parse(parsedBody);

    const data = await updateFileClassification(actor, fileId, body.classification);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = withActorRequestContext(PUTHandler);
