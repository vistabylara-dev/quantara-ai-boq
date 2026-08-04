/**
 * MASTER-BOQ-1A — maps the existing, validated HVAC master-data rows (all
 * currently under the "mechanical" MasterDiscipline) into the new deep
 * hierarchy:
 *
 *   Construction (INDUSTRY) -> Mechanical (DISCIPLINE) -> HVAC (SYSTEM)
 *   -> <existing category> (CATEGORY) -> <existing item> (linked via
 *   MasterItem.hierarchyNodeId)
 *
 * Nothing about Subcategory/Item Family/UniFormat/IFC/labor norms/prices is
 * fabricated — those levels/fields are simply not created for rows that
 * never had that data. Idempotent and restartable: hierarchy nodes are
 * created via createHierarchyNode (idempotent on `code`), and item links are
 * re-derived and re-applied deterministically from categoryId on every run,
 * so a second run changes nothing and creates no duplicates.
 *
 * Usage:
 *   npx tsx prisma/backfill-master-boq-hierarchy.ts --dry-run
 *   npx tsx prisma/backfill-master-boq-hierarchy.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHierarchyNode } from "../src/lib/repositories/master-hierarchy-repository";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

const INDUSTRY_CODE = "construction";
const DISCIPLINE_CODE = "construction.mechanical";
const SYSTEM_CODE = "construction.mechanical.hvac";

function categoryCode(categoryKey: string): string {
  return `${SYSTEM_CODE}.${categoryKey}`;
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`MASTER-BOQ-1A HVAC hierarchy backfill — ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const mechanicalDiscipline = await prisma.masterDiscipline.findUnique({ where: { key: "mechanical" } });
  if (!mechanicalDiscipline) {
    console.log("No 'mechanical' MasterDiscipline found — nothing to backfill.");
    await prisma.$disconnect();
    return;
  }

  const categories = await prisma.masterCategory.findMany({ where: { disciplineId: mechanicalDiscipline.id } });
  const items = await prisma.masterItem.findMany({ where: { disciplineId: mechanicalDiscipline.id } });

  console.log(`Found ${categories.length} categories and ${items.length} items under 'mechanical'.`);

  if (dryRun) {
    console.log("Would create: 1 INDUSTRY node, 1 DISCIPLINE node, 1 SYSTEM node,", categories.length, "CATEGORY nodes.");
    console.log(`Would link ${items.length} items to their category's hierarchy node.`);
    const alreadyLinked = items.filter((item) => item.hierarchyNodeId !== null).length;
    console.log(`${alreadyLinked} item(s) already linked — a real run would leave those unchanged if the mapping is identical (idempotent).`);
    await prisma.$disconnect();
    return;
  }

  const industry = await createHierarchyNode({ code: INDUSTRY_CODE, name: "Construction", nodeType: "INDUSTRY", parentId: null, sortOrder: 0 });
  const discipline = await createHierarchyNode({ code: DISCIPLINE_CODE, name: "Mechanical", nodeType: "DISCIPLINE", parentId: industry.id, sortOrder: 0 });
  const system = await createHierarchyNode({ code: SYSTEM_CODE, name: "HVAC", nodeType: "SYSTEM", parentId: discipline.id, sortOrder: 0 });

  const categoryNodeIdByCategoryId = new Map<string, string>();
  for (const category of categories) {
    const node = await createHierarchyNode({
      code: categoryCode(category.key),
      name: category.name,
      description: category.description,
      nodeType: "CATEGORY",
      parentId: system.id,
      sortOrder: category.sortOrder,
    });
    categoryNodeIdByCategoryId.set(category.id, node.id);
  }
  console.log(`Ensured ${categoryNodeIdByCategoryId.size} CATEGORY hierarchy nodes under HVAC.`);

  let linked = 0;
  let unchanged = 0;
  let skippedNoCategory = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    for (const item of batch) {
      const targetNodeId = categoryNodeIdByCategoryId.get(item.categoryId);
      if (!targetNodeId) {
        skippedNoCategory += 1;
        continue;
      }
      if (item.hierarchyNodeId === targetNodeId) {
        unchanged += 1;
        continue;
      }
      await prisma.masterItem.update({ where: { id: item.id }, data: { hierarchyNodeId: targetNodeId } });
      linked += 1;
    }
  }

  console.log(`Linked ${linked} item(s), ${unchanged} already correct, ${skippedNoCategory} skipped (no matching category node).`);
  console.log("Backfill complete.");
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
