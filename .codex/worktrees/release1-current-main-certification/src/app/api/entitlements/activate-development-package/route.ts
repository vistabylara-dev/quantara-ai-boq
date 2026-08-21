import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { requireCapability } from "@/lib/auth/rbac";
import { activateDevelopmentPackage } from "@/lib/entitlements/package-entitlement-service";
import { activateDevelopmentPackageSchema } from "@/lib/validation/phase7-schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    requireCapability(actor, "entitlements:manage");
    const { packageKeyOrId } = await parseJsonBody(request, activateDevelopmentPackageSchema);
    await activateDevelopmentPackage(actor, packageKeyOrId);
    return apiSuccess({ activated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
