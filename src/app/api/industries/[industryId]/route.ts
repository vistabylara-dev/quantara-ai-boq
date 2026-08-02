import { z } from "zod";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { setIndustryEnabled } from "@/lib/repositories/industry-repository";

const industryUpdateSchema = z.object({ enabled: z.boolean() }).strict();

type RouteContext = {
  params: { industryId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "company:manage");
    const input = await parseJsonBody(request, industryUpdateSchema);
    const link = await setIndustryEnabled(
      actor.companyId,
      params.industryId,
      input.enabled,
    );
    return apiSuccess({
      id: link.industryEngine.key,
      databaseId: link.industryEngine.id,
      companyIndustryEngineId: link.id,
      key: link.industryEngine.key,
      name: link.industryEngine.name,
      description: link.industryEngine.description,
      isActive: link.industryEngine.isActive,
      enabled: link.enabled,
      configJson: link.industryEngine.configJson,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
