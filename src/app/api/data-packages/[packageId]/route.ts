import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { getPackage } from "@/lib/repositories/industry-package-repository";
import { companyHasPackageAccess } from "@/lib/entitlements/package-entitlement-service";
import { packageIdParamsSchema } from "@/lib/validation/route-params";
import { resolvePackagePurchaseOptions } from "@/lib/services/package-purchase-options";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ packageId: string }> };

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const params = await context.params;
    const { packageId } = packageIdParamsSchema.parse(params);
    const pkg = await getPackage(packageId);
    const hasAccess = await companyHasPackageAccess(actor.companyId, pkg.id);
    const purchaseByPackageId = await resolvePackagePurchaseOptions(actor, [pkg.id]);
    return apiSuccess({ ...pkg, hasAccess, purchase: purchaseByPackageId.get(pkg.id) ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
