import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import {
  deactivateCatalogueItemForCompany,
  getCatalogueItemForCompany,
  updateCatalogueItemForCompany,
} from "@/lib/services/catalogue-service";
import { catalogueItemUpdateSchema } from "@/lib/validation/catalogue-schema";
import { catalogueItemIdParamsSchema } from "@/lib/validation/route-params";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    return apiSuccess(await getCatalogueItemForCompany(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    const input = await parseJsonBody(request, catalogueItemUpdateSchema);
    const item = await updateCatalogueItemForCompany(actor, itemId, input);
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    return apiSuccess(await deactivateCatalogueItemForCompany(actor, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}
