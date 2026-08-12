import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findMany({ where: { platformRole: 'PLATFORM_OWNER' } }).then(u => {
  console.log(JSON.stringify(u, null, 2));
  prisma.$disconnect();
});
