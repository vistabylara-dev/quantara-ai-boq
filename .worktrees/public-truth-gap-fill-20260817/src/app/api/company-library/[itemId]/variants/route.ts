import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { createVariantForCompany, listVariantsForCompany } from "@/lib/services/company-library-service";
import { companyLibraryVariantSchema } from "@/lib/validation/phase7-schema";
import { libraryItemIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const data = await listVariantsForCompany(actor, itemId);
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
    const { itemId } = libraryItemIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, companyLibraryVariantSchema);
    const data = await createVariantForCompany(actor, itemId, input);
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
