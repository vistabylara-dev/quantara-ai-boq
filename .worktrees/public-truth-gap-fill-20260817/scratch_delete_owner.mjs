import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "platformRole" = 'PLATFORM_OWNER'`);
  console.log(`Deleted platform owners.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
