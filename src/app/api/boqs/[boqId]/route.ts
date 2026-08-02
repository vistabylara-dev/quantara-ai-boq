import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { getBOQ, updateBOQ } from "@/lib/repositories/boq-repository";
import {
  boqIdParamsSchema,
  frontendBOQUpdateSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: { boqId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { boqId } = boqIdParamsSchema.parse(context.params);
    const data = await getBOQ(actor.companyId, boqId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "boq:edit");
    const { boqId } = boqIdParamsSchema.parse(context.params);
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
