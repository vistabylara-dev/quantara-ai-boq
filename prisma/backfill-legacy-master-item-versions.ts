/**
 * MASTER-SCALE-1B — the 44 pre-existing MasterItem rows (created before any
 * MasterCatalogueImportBatch/import-service existed, source untraceable —
 * see the MASTER-SCALE-1B audit report) have zero MasterItemVersion rows.
 * The task's "at least one published version exists for every usable item"
 * requirement applies to them too, but nothing about their specification,
 * classification, or attributes can be honestly filled in — there is no
 * source data for those fields. This backfill creates version 1 PUBLISHED
 * using only each item's own existing name/shortDescription/fullDescription/
 * defaultUnit, leaving specificationTemplate empty rather than fabricating
 * one. Idempotent: an item that already has any version is skipped.
 *
 * Usage:
 *   npx tsx prisma/backfill-legacy-master-item-versions.ts --dry-run
 *   npx tsx prisma/backfill-legacy-master-item-versions.ts
 */
import { PrismaClient, PlatformRole, MasterItemVersionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`MASTER-SCALE-1B legacy MasterItem version backfill — ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const owner = await prisma.user.findFirst({ where: { platformRole: PlatformRole.PLATFORM_OWNER }, select: { id: true, email: true } });
  if (!owner) {
    console.error("No PLATFORM_OWNER user found — cannot attribute this backfill to an actor. Aborting.");
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Acting as platform owner: ${owner.email}`);

  const itemsWithoutVersions = await prisma.masterItem.findMany({
    where: { versions: { none: {} } },
    select: { id: true, itemCode: true, name: true, shortDescription: true, fullDescription: true, defaultUnit: true },
  });

  console.log(`Found ${itemsWithoutVersions.length} item(s) with zero versions.`);

  if (dryRun) {
    console.log("Would create version 1 (PUBLISHED) for each, using only existing name/shortDescription/fullDescription/defaultUnit — no specification/classification fabricated.");
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  for (const item of itemsWithoutVersions) {
    await prisma.masterItemVersion.create({
      data: {
        masterItemId: item.id,
        versionNumber: 1,
        status: MasterItemVersionStatus.PUBLISHED,
        effectiveDate: new Date(),
        changeSummary: "Backfilled from the item's own pre-existing fields — no source specification/classification data was available for this legacy record.",
        name: item.name,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
        primaryUnit: item.defaultUnit,
        createdByUserId: owner.id,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} version(s).`);
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
