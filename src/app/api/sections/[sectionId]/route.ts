import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  deleteBOQSection,
  updateBOQSection,
} from "@/lib/repositories/boq-repository";
import {
  sectionIdParamsSchema,
  sectionWriteRouteSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: { sectionId: string } };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:edit");
    const { sectionId } = sectionIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, sectionWriteRouteSchema);
    const data = await updateBOQSection(actor.companyId, sectionId, input);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:edit");
    const { sectionId } = sectionIdParamsSchema.parse(context.params);
    const data = await deleteBOQSection(actor.companyId, sectionId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
