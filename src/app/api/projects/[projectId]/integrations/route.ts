import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listProjectIntegrationsForActor } from "@/lib/services/integration-service";
import { linkProjectSource } from "@/lib/services/project-integration-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

const linkSchema = z.object({
  externalConnectionId: z.string().uuid(),
  externalAccountId: z.string().max(255).optional(),
  externalProjectId: z.string().max(255).optional(),
  externalFolderId: z.string().max(255).optional(),
  externalFileId: z.string().max(255).optional(),
  externalModelId: z.string().max(255).optional(),
  externalVersionId: z.string().max(255).optional(),
});

/** External project/model/folder/file links for this Quantara project. */
async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const data = await listProjectIntegrationsForActor(actor, projectId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Links a connected external source (project/folder/file/model/version) to this Quantara project. */
async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { projectId } = projectIdParamsSchema.parse(await context.params);
    const input = linkSchema.parse(await request.json());
    return apiSuccess(await linkProjectSource(actor, projectId, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
