import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { listPackages } from "@/lib/repositories/industry-package-repository";
import { companyHasPackageAccess } from "@/lib/entitlements/package-entitlement-service";

export const dynamic = "force-dynamic";

async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const packages = await listPackages();
    const withAccess = await Promise.all(
      packages.map(async (pkg) => ({ ...pkg, hasAccess: await companyHasPackageAccess(actor.companyId, pkg.id) })),
    );
    return apiSuccess(withAccess);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
