import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { createSupplierForCompany, listSuppliersForCompany } from "@/lib/services/supplier-service";
import { supplierCreateSchema, supplierListQuerySchema } from "@/lib/validation/supplier-schema";

async function GETHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const url = new URL(request.url);
    const query = supplierListQuerySchema.parse({
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      includeInactive: url.searchParams.get("includeInactive") ?? undefined,
    });
    const result = await listSuppliersForCompany(actor, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const input = await parseJsonBody(request, supplierCreateSchema);
    const supplier = await createSupplierForCompany(actor, input);
    return apiSuccess(supplier, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
export const POST = withActorRequestContext(POSTHandler);
