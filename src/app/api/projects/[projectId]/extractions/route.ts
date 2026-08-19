import { z } from "zod";
import { ExtractedEntityType } from "@prisma/client";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { listEntitiesForProject, manuallyAddExtractedEntity } from "@/lib/services/extracted-entity-service";
import { projectIdParamsSchema } from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

const addEntityBodySchema = z.object({
  projectFileId: z.string().uuid(),
  entityType: z.string(),
  label: z.string().trim().min(1).max(200),
  quantity: z.number().optional(),
  unit: z.string().max(20).optional(),
  sourceText: z.string().max(500).optional(),
}).strict();

async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const project = await getProjectRecord(actor.companyId, projectId);
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    const data = await listEntitiesForProject(actor, project.id, {
      status: url.searchParams.get("status") ?? undefined,
      entityType: url.searchParams.get("entityType") ?? undefined,
      ids: idsParam ? idsParam.split(",").map((id) => id.trim()).filter(Boolean) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { projectId } = projectIdParamsSchema.parse(params);
    const body = await parseJsonBody(request, addEntityBodySchema);
    const data = await manuallyAddExtractedEntity(actor, {
      projectId,
      projectFileId: body.projectFileId,
      entityType: body.entityType as ExtractedEntityType,
      label: body.label,
      quantity: body.quantity,
      unit: body.unit,
      confidence: 100,
      extractionMethod: "MANUAL",
      sourceText: body.sourceText,
    });
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
