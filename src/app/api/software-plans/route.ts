import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const plans = await prisma.softwarePlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
    return apiSuccess(
      plans.map((plan) => ({
        id: plan.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        planType: plan.planType,
        monthlyPrice: plan.monthlyPrice.toNumber(),
        annualPrice: plan.annualPrice.toNumber(),
        currency: plan.currency,
        maxUsers: plan.maxUsers,
        maxProjects: plan.maxProjects,
        maxActiveBoqs: plan.maxActiveBoqs,
        maxDocumentsPerMonth: plan.maxDocumentsPerMonth,
        featuresJson: plan.featuresJson,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
