import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { listAccessibleMasterItems } from "@/lib/entitlements/package-entitlement-service";
import { packageIdParamsSchema } from "@/lib/validation/route-params";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ packageId: string }> };

/** Requires active package access — full item list is never sent to a company without it. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { packageId } = packageIdParamsSchema.parse(params);
    const items = await listAccessibleMasterItems(actor.companyId, packageId);
    return apiSuccess(items.map((item) => ({ id: item.id, itemCode: item.itemCode, name: item.name, shortDescription: item.shortDescription, defaultUnit: item.defaultUnit })));
  } catch (error) {
    return handleApiError(error);
  }
}
