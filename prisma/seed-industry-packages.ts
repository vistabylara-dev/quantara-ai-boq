/**
 * Seeds IndustryDataPackage + IndustryDataPackageItem rows from real
 * MasterItem data already in the database, so the /marketplace page has
 * real, purchasable packages instead of "No packages published yet."
 *
 * Deliberately only seeds disciplines that actually have MasterItem rows —
 * checked via prisma/check-master-catalogue-state.ts before writing this.
 * As of 2026-08-05 in `quantara_staging`, only Mechanical has real items
 * (44). Construction, Electrical, Fire Fighting, and Plumbing all show 0
 * MasterItem rows and are intentionally NOT seeded here — creating a
 * "package" with zero items would be selling something that doesn't exist.
 * Re-run this script (safe, idempotent) once those disciplines' master
 * catalogue import work lands real items.
 *
 * Usage: npx tsx prisma/seed-industry-packages.ts
 */
import { PrismaClient } from "@prisma/client";
import { createPackage, addItemsToPackage } from "../src/lib/repositories/industry-package-repository";

const prisma = new PrismaClient();

const DISCIPLINE_PACKAGES: {
  disciplineName: string;
  key: string;
  name: string;
  description: string;
  packageType: "CORE" | "PROFESSIONAL" | "SPECIALIST" | "ENTERPRISE" | "REGIONAL";
  isFeatured?: boolean;
}[] = [
  {
    disciplineName: "Mechanical",
    key: "mechanical-core",
    name: "Mechanical Core Data Package",
    description: "Master catalogue items for mechanical/HVAC works — equipment, ductwork, and system components with standard units and specifications.",
    packageType: "CORE",
    isFeatured: true,
  },
  // Construction / Electrical / Fire Fighting / Plumbing intentionally
  // omitted — 0 MasterItem rows in production as of this script's writing.
  // Add an entry here once that discipline's master catalogue import runs.
];

async function main(): Promise<void> {
  let seeded = 0;
  let skippedEmpty = 0;

  for (const pkg of DISCIPLINE_PACKAGES) {
    const discipline = await prisma.masterDiscipline.findFirst({ where: { name: pkg.disciplineName } });
    if (!discipline) {
      console.log(`Skipping "${pkg.name}" — no MasterDiscipline named "${pkg.disciplineName}" found.`);
      continue;
    }

    const items = await prisma.masterItem.findMany({
      where: { disciplineId: discipline.id, status: "ACTIVE" },
      select: { id: true },
      orderBy: { itemCode: "asc" },
    });

    if (items.length === 0) {
      console.log(`Skipping "${pkg.name}" — discipline "${pkg.disciplineName}" has 0 active MasterItem rows.`);
      skippedEmpty += 1;
      continue;
    }

    const created = await createPackage({
      key: pkg.key,
      name: pkg.name,
      description: pkg.description,
      disciplineId: discipline.id,
      packageType: pkg.packageType,
      isFeatured: pkg.isFeatured ?? false,
    });

    await addItemsToPackage(created.id, items.map((i) => i.id));
    console.log(`Seeded "${pkg.name}" with ${items.length} items.`);
    seeded += 1;
  }

  console.log(`\nDone. Packages seeded: ${seeded}, skipped (no items): ${skippedEmpty}.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
