import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { z } from "zod";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import {
  deleteRateCatalogueItem,
  updateRateCatalogueItem,
} from "@/lib/repositories/rate-catalogue-repository";
import { rateCatalogueItemUpdateSchema } from "@/lib/validation/backend-schemas";
import { catalogueItemIdParamsSchema } from "@/lib/validation/route-params";

type CatalogueUpdateRequest = z.output<typeof rateCatalogueItemUpdateSchema>;

type RouteContext = {
  params: { itemId: string };
};

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "catalogue:manage");
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    const input = await parseJsonBody<CatalogueUpdateRequest>(
      request,
      rateCatalogueItemUpdateSchema as unknown as z.ZodSchema<CatalogueUpdateRequest>,
    );
    const item = await updateRateCatalogueItem(actor.companyId, itemId, input);
    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "catalogue:manage");
    const { itemId } = catalogueItemIdParamsSchema.parse(params);
    return apiSuccess(await deleteRateCatalogueItem(actor.companyId, itemId));
  } catch (error) {
    return handleApiError(error);
  }
}
