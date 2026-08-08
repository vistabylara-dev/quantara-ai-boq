import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { prefillDimensionValues } from "@/lib/services/quantity-calculation-service";
import { prefillDimensionsQuerySchema } from "@/lib/validation/quantity-calculation-schema";

export const dynamic = "force-dynamic";

/** Read-only evidence lookup (spec section 3) — never invents a value, only surfaces what already exists on the extracted entity / detected room. */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = prefillDimensionsQuerySchema.parse({
      calculationType: url.searchParams.get("calculationType"),
      projectId: url.searchParams.get("projectId"),
      extractedEntityId: url.searchParams.get("extractedEntityId") ?? undefined,
      detectedRoomId: url.searchParams.get("detectedRoomId") ?? undefined,
    });
    const data = await prefillDimensionValues(actor.companyId, query.calculationType, {
      projectId: query.projectId,
      extractedEntityId: query.extractedEntityId,
      detectedRoomId: query.detectedRoomId,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
