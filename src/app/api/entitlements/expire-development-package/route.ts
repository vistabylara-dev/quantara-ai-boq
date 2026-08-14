import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { expireDevelopmentPackage } from "@/lib/entitlements/package-entitlement-service";
import { activateDevelopmentPackageSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");
    const { packageKeyOrId } = await parseJsonBody(request, activateDevelopmentPackageSchema);
    await expireDevelopmentPackage(actor, packageKeyOrId);
    return apiSuccess({ expired: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withActorRequestContext(POSTHandler);
