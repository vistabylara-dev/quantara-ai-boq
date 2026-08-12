import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function wipe() {
  const existingOwners = await prisma.user.findMany({ where: { platformRole: 'PLATFORM_OWNER' } });
  if (existingOwners.length > 0) {
    const companyIds = existingOwners.map((u) => u.companyId).filter(Boolean) as string[];
    const userIds = existingOwners.map((u) => u.id);
    
    await prisma.platformSimulationSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.platformAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    
    await prisma.masterItem.deleteMany({ where: { sourceBatch: { actorUserId: { in: userIds } } } });
    await prisma.masterCatalogueImportBatch.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.masterCatalogueImportJob.deleteMany({ where: { actorUserId: { in: userIds } } });
    
    if (companyIds.length > 0) {
      try {
        await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
      } catch (e) {
        console.error("Failed to delete company directly, falling back to manual cleanup", e);
        await prisma.bOQItem.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.bOQSection.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.bOQ.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.project.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.client.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
        await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
      }
    }
    await prisma.user.deleteMany({ where: { platformRole: 'PLATFORM_OWNER' } });
  }
  console.log("Wiped " + existingOwners.length + " owners.");
}

wipe().finally(() => prisma.$disconnect());
