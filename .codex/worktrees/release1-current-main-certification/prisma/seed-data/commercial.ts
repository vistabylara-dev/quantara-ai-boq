import type { PrismaClient } from "@prisma/client";

export async function seedSoftwarePlans(prisma: PrismaClient): Promise<void> {
  const plans = [
    {
      key: "free",
      name: "Free",
      description: "Company profile, manual item creation, one draft project.",
      planType: "FREE" as const,
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 1,
      maxProjects: 1,
      maxActiveBoqs: 1,
      maxDocumentsPerMonth: 0,
      featuresJson: { bulkExport: false, apiAccess: false, premiumMasterData: false },
    },
    {
      key: "trial-pro",
      name: "Pro Trial",
      description: "3-day Pro trial: one project, one completed BOQ, five premium items, one export.",
      planType: "TRIAL" as const,
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 3,
      maxProjects: 1,
      maxActiveBoqs: 1,
      maxDocumentsPerMonth: 1,
      featuresJson: { bulkExport: false, apiAccess: false, premiumMasterData: "trial-allowance" },
    },
    {
      key: "pro",
      name: "Pro",
      description: "Full projects, BOQs, clients, suppliers, catalogue, revisions, verification, documents, proposal portal.",
      planType: "PRO" as const,
      monthlyPrice: 49,
      annualPrice: 490,
      maxUsers: 5,
      maxProjects: null,
      maxActiveBoqs: null,
      maxDocumentsPerMonth: null,
      featuresJson: { bulkExport: false, apiAccess: false, premiumMasterData: "package-required" },
    },
    {
      key: "business",
      name: "Business",
      description: "Pro plus higher usage limits and bulk export.",
      planType: "BUSINESS" as const,
      monthlyPrice: 149,
      annualPrice: 1490,
      maxUsers: 20,
      maxProjects: null,
      maxActiveBoqs: null,
      maxDocumentsPerMonth: null,
      featuresJson: { bulkExport: true, apiAccess: false, premiumMasterData: "package-required" },
    },
    {
      key: "enterprise",
      name: "Enterprise",
      description: "Multiple offices, custom roles, approval chains, API, custom templates, private packages, regional hosting.",
      planType: "ENTERPRISE" as const,
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: null,
      maxProjects: null,
      maxActiveBoqs: null,
      maxDocumentsPerMonth: null,
      featuresJson: { bulkExport: true, apiAccess: true, premiumMasterData: "package-required", contactSales: true },
    },
  ];

  for (const plan of plans) {
    await prisma.softwarePlan.upsert({
      where: { key: plan.key },
      update: {},
      create: plan,
    });
  }
}

export async function seedMechanicalPackage(prisma: PrismaClient, disciplineId: string, itemIds: string[]): Promise<void> {
  const pkg = await prisma.industryDataPackage.upsert({
    where: { key: "mechanical-hvac-professional" },
    update: {},
    create: {
      key: "mechanical-hvac-professional",
      name: "Mechanical HVAC Professional Package",
      description: "Full HVAC equipment and fan technical reference library — specifications, dynamic technical fields, and standard units ready for BOQ insertion.",
      disciplineId,
      packageType: "PROFESSIONAL",
      itemCount: itemIds.length,
      monthlyPrice: 199,
      annualPrice: 1999,
      currency: "USD",
      status: "ACTIVE",
      isFeatured: true,
    },
  });

  for (const [index, masterItemId] of itemIds.entries()) {
    await prisma.industryDataPackageItem.upsert({
      where: { packageId_masterItemId: { packageId: pkg.id, masterItemId } },
      update: {},
      create: { packageId: pkg.id, masterItemId, sortOrder: index },
    });
  }

  const count = await prisma.industryDataPackageItem.count({ where: { packageId: pkg.id } });
  await prisma.industryDataPackage.update({ where: { id: pkg.id }, data: { itemCount: count } });
}
