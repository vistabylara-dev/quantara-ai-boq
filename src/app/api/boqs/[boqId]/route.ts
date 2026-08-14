import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getBOQ, updateBOQ } from "@/lib/repositories/boq-repository";
import {
  boqIdParamsSchema,
  frontendBOQUpdateSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ boqId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);
    const data = await getBOQ(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUTHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const params = await context.params;
    const { boqId } = boqIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, frontendBOQUpdateSchema);
    const companyId = actor.companyId;
    const current = await getBOQ(companyId, boqId);
    const data = await updateBOQ(companyId, boqId, {
      ...input,
      id: current.id,
      projectId: current.projectId,
      sections: input.sections.map((section) => ({
        ...section,
        description: section.description ?? "",
        items: section.items.map((item) => ({
          ...item,
          specification: item.specification ?? "",
          notes: item.notes ?? "",
        })),
      })),
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const PUT = withActorRequestContext(PUTHandler);
