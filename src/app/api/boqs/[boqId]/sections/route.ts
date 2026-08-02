import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { createBOQSection } from "@/lib/repositories/boq-repository";
import {
  boqIdParamsSchema,
  sectionWriteRouteSchema,
} from "@/lib/validation/boq-route-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: { boqId: string } }) {
  try {
    const actor = await getCurrentActor();
    requireCapability(actor, "boq:edit");
    const { boqId } = boqIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, sectionWriteRouteSchema);
    const data = await createBOQSection(actor.companyId, boqId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
