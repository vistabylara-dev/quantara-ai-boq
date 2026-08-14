import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listAccessibleMasterItemsPaginated } from "@/lib/entitlements/package-entitlement-service";
import { packageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ packageId: string }> };

/** Requires active package access — full item list is never sent to a company without it. */
async function GETHandler(request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { packageId } = packageIdParamsSchema.parse(params);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
    const search = url.searchParams.get("search") || undefined;

    const result = await listAccessibleMasterItemsPaginated(actor.companyId, packageId, { page, pageSize, search });
    
    return apiSuccess({
      total: result.total,
      items: result.items.map((item) => ({ id: item.id, itemCode: item.itemCode, name: item.name, shortDescription: item.shortDescription, defaultUnit: item.defaultUnit }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
