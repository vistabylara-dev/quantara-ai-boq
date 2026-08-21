import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
/**
 * CATALOGUE-CLOSE — normalizes the 13 validated, staged plumbing CSVs
 * (data-imports/plumbing/*.csv, 13,111 rows combined) into the master
 * catalogue via plumbing-master-import-service.ts / the generic
 * master-catalogue-bulk-import-service.ts engine. Idempotent and safe to
 * re-run — a second run against unchanged CSVs produces 0 inserts.
 *
 * Usage:
 *   npx tsx prisma/import-plumbing-master-catalogue.ts --dry-run
 *   npx tsx prisma/import-plumbing-master-catalogue.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PlatformRole } from "@prisma/client";
import { dryRunPlumbingImport, executePlumbingImport } from "../src/lib/services/plumbing-master-import-service";

const prisma = createDirectPrismaClient();
const DIR = "data-imports/plumbing";

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`CATALOGUE-CLOSE plumbing master catalogue import — ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const ownerRow = await prisma.user.findFirst({ where: { platformRole: PlatformRole.PLATFORM_OWNER }, select: { id: true, companyId: true, platformRole: true, fullName: true, email: true } });
  if (!ownerRow) {
    console.error("No PLATFORM_OWNER user found — cannot attribute this import to an actor. Aborting.");
    await prisma.$disconnect();
    process.exit(1);
  }
  const owner = { userId: ownerRow.id, companyId: ownerRow.companyId, platformRole: ownerRow.platformRole!, fullName: ownerRow.fullName, email: ownerRow.email };
  console.log(`Acting as platform owner: ${owner.email}`);

  const files = readdirSync(join(__dirname, "..", DIR)).filter((f) => f.endsWith(".csv")).sort();
  console.log(`Found ${files.length} plumbing source files.`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalRejected = 0;

  for (const fileName of files) {
    const csvText = readFileSync(join(__dirname, "..", DIR, fileName), "utf-8");
    console.log(`\n--- ${fileName} ---`);

    if (dryRun) {
      const result = await dryRunPlumbingImport(owner, { uploadedFileName: fileName, csvText });
      console.log(`Total rows: ${result.totalRows}, valid: ${result.validRows}, rejected: ${result.rejectedRows}, warnings: ${result.warningRows}`);
      console.log(`Would insert: ${result.inserted}, update: ${result.updated}, unchanged: ${result.unchanged}`);
      const rejected = result.rows.filter((r) => r.outcome === "rejected");
      if (rejected.length > 0) console.log("Rejected rows:", JSON.stringify(rejected.slice(0, 20), null, 2));
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalUnchanged += result.unchanged;
      totalRejected += result.rejectedRows;
    } else {
      const result = await executePlumbingImport(owner, { uploadedFileName: fileName, csvText });
      console.log(`Batch ${result.id}: inserted ${result.insertedCount}, updated ${result.updatedCount}, unchanged ${result.unchangedCount}, rejected ${result.rejectedCount}`);
      totalInserted += result.insertedCount;
      totalUpdated += result.updatedCount;
      totalUnchanged += result.unchangedCount;
      totalRejected += result.rejectedCount;
    }
  }

  console.log(`\n=== TOTAL across ${files.length} files ===`);
  console.log({ totalInserted, totalUpdated, totalUnchanged, totalRejected });
  console.log("\nDone.");
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
