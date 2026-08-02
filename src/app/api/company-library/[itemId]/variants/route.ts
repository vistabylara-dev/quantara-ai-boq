import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { createVariantForCompany, listVariantsForCompany } from "@/lib/services/company-library-service";
import { companyLibraryVariantSchema } from "@/lib/validation/phase7-schema";
import { libraryItemIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: { itemId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = libraryItemIdParamsSchema.parse(context.params);
    const data = await listVariantsForCompany(actor, itemId);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const { itemId } = libraryItemIdParamsSchema.parse(context.params);
    const input = await parseJsonBody(request, companyLibraryVariantSchema);
    const data = await createVariantForCompany(actor, itemId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
