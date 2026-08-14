import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
/**
 * Read-only diagnostic — no writes. Reports how many MasterDiscipline and
 * MasterItem rows currently exist in the target database, grouped by
 * discipline, so we know whether the master catalogue has real data to build
 * IndustryDataPackage packages from before writing any seed script.
 *
 * Usage: npx tsx prisma/check-master-catalogue-state.ts
 */

const prisma = createDirectPrismaClient();

async function main(): Promise<void> {
  const disciplines = await prisma.masterDiscipline.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true, _count: { select: { items: true } } },
  });

  const totalItems = await prisma.masterItem.count();
  const totalDisciplines = disciplines.length;

  console.log(`\nMasterDiscipline rows: ${totalDisciplines}`);
  console.log(`MasterItem rows (total): ${totalItems}\n`);

  if (totalDisciplines === 0) {
    console.log("No disciplines found at all — master catalogue is fully empty.");
  } else {
    console.log("Per-discipline breakdown:");
    for (const d of disciplines) {
      console.log(`  ${d.isActive ? " " : "(inactive)"} ${d.name.padEnd(30)} items: ${d._count.items}`);
    }
  }

  const existingPackages = await prisma.industryDataPackage.count();
  console.log(`\nExisting IndustryDataPackage rows: ${existingPackages}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
