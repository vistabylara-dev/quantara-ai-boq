import { PlanType, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../src/lib/db/prisma";

/**
 * Test fixtures create multiple projects/BOQs per company, which is
 * unlimited on a real Pro/Business plan but capped at one on the FREE
 * default a company gets with no subscription (see entitlement-service.ts).
 * Grants an active PRO-equivalent subscription so existing test flows keep
 * their pre-Phase-7 unrestricted behavior.
 */
export async function grantUnlimitedPlanForTests(companyId: string): Promise<void> {
  const plan = await prisma.softwarePlan.upsert({
    where: { key: "test-unlimited" },
    update: {},
    create: {
      key: "test-unlimited",
      name: "Test Unlimited",
      planType: PlanType.PRO,
      maxUsers: null,
      maxProjects: null,
      maxActiveBoqs: null,
      maxDocumentsPerMonth: null,
    },
  });
  await prisma.companySoftwareSubscription.create({
    data: {
      companyId,
      softwarePlanId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startsAt: new Date(),
      source: "test-fixture",
    },
  });
}
