/**
 * MASTER-SCALE-1B — normalizes the two validated, staged HVAC CSVs
 * (data-imports/hvac/*.csv, 707 + 184 = 891 rows) into the master catalogue
 * via hvac-master-import-service.ts. Requires the MASTER-BOQ-1A hierarchy
 * backfill (Construction -> Mechanical -> HVAC) to already exist — the
 * service throws HIERARCHY_NOT_READY if it doesn't, rather than creating it
 * here.
 *
 * Idempotent and safe to re-run: a second run against unchanged CSVs
 * produces 0 inserts, 0 new versions, 0 new classifications for every row
 * (all "unchanged").
 *
 * Usage:
 *   npx tsx prisma/import-hvac-master-catalogue.ts --dry-run
 *   npx tsx prisma/import-hvac-master-catalogue.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, PlatformRole } from "@prisma/client";
import { dryRunHvacMasterImport, executeHvacMasterImport } from "../src/lib/services/hvac-master-import-service";

const prisma = new PrismaClient();

const FILES = [
  "data-imports/hvac/hvac-company-library-import.csv",
  "data-imports/hvac/hvac-air-distribution-company-library-import.csv",
];

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`MASTER-SCALE-1B HVAC master catalogue import — ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const ownerRow = await prisma.user.findFirst({ where: { platformRole: PlatformRole.PLATFORM_OWNER }, select: { id: true, companyId: true, platformRole: true, fullName: true, email: true } });
  if (!ownerRow) {
    console.error("No PLATFORM_OWNER user found — cannot attribute this import to an actor. Aborting.");
    await prisma.$disconnect();
    process.exit(1);
  }
  const owner = { userId: ownerRow.id, companyId: ownerRow.companyId, platformRole: ownerRow.platformRole!, fullName: ownerRow.fullName, email: ownerRow.email };
  console.log(`Acting as platform owner: ${owner.email}`);

  for (const relativePath of FILES) {
    const absolutePath = join(__dirname, "..", relativePath);
    const csvText = readFileSync(absolutePath, "utf-8");
    const uploadedFileName = relativePath.split("/").pop()!;
    console.log(`\n--- ${uploadedFileName} ---`);

    if (dryRun) {
      const result = await dryRunHvacMasterImport(owner, { uploadedFileName, csvText });
      console.log(`Total rows: ${result.totalRows}, valid: ${result.validRows}, rejected: ${result.rejectedRows}, warnings: ${result.warningRows}`);
      console.log(`Would insert: ${result.inserted}, update: ${result.updated}, unchanged: ${result.unchanged}`);
      const rejected = result.rows.filter((r) => r.outcome === "rejected");
      if (rejected.length > 0) console.log("Rejected rows:", JSON.stringify(rejected.slice(0, 20), null, 2));
    } else {
      const result = await executeHvacMasterImport(owner, { uploadedFileName, csvText });
      console.log(`Batch ${result.id}: inserted ${result.insertedCount}, updated ${result.updatedCount}, unchanged ${result.unchangedCount}, rejected ${result.rejectedCount}`);
      console.log("Summary:", JSON.stringify(result.summary, null, 2));
    }
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
