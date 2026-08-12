import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getCompanyEntitlements, getTrialUsageSummary } from "@/lib/entitlements/entitlement-service";
import { listCompanyAccessiblePackages } from "@/lib/entitlements/package-entitlement-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const [entitlements, trialUsage, packages, company] = await Promise.all([
      getCompanyEntitlements(actor.companyId),
      getTrialUsageSummary(actor.companyId),
      listCompanyAccessiblePackages(actor.companyId),
      prisma.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { isTestCompany: true } }),
    ]);
    // isTestCompany is exposed only so the client can hide the development
    // plan-activation UI for real customers — the actual security boundary
    // is server-side, in entitlement-service.ts's assertDevelopmentControlsAllowed.
    return apiSuccess({ entitlements, trialUsage, packages, isTestCompany: company.isTestCompany });
  } catch (error) {
    return handleApiError(error);
  }
}
