import { readFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { listDatasetDefinitions } from "../src/lib/services/catalogue-dataset-registry";
import {
  REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES,
  ensureCatalogueReferenceDisciplines,
} from "../src/lib/services/catalogue-reference-disciplines-migration-service";

const RUN_ID = `${Date.now()}-${process.pid}`;
const TEST_KEY_A = `test-ref-discipline-a-${RUN_ID}`;
const TEST_KEY_B = `test-ref-discipline-b-${RUN_ID}`;
const SYNTHETIC_DISCIPLINES = [
  { key: TEST_KEY_A, name: "Test Reference Discipline A", description: "Synthetic, test-only.", icon: "test" },
  { key: TEST_KEY_B, name: "Test Reference Discipline B", description: "Synthetic, test-only.", icon: "test" },
] as const;

async function deleteSyntheticRows() {
  await prisma.masterDiscipline.deleteMany({ where: { key: { in: [TEST_KEY_A, TEST_KEY_B] } } });
}

describe("CATALOGUE-INTEGRITY-REPAIR: reference-data migration logic", () => {
  afterEach(deleteSyntheticRows);
  afterAll(deleteSyntheticRows);

  it("authoritative master-data.ts contains interior-fit-out and landscaping", () => {
    const source = readFileSync("prisma/seed-data/master-data.ts", "utf-8");
    expect(source).toContain('key: "interior-fit-out"');
    expect(source).toContain('key: "landscaping"');
  });

  it("REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES matches the authoritative master-data.ts values exactly", () => {
    const interiorFitOut = REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.find((d) => d.key === "interior-fit-out");
    const landscaping = REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.find((d) => d.key === "landscaping");
    expect(interiorFitOut).toEqual({ key: "interior-fit-out", name: "Interior Fit-Out", description: "Interior fit-out and finishing works.", icon: "layout" });
    expect(landscaping).toEqual({ key: "landscaping", name: "Landscaping", description: "Soft and hard landscaping works.", icon: "tree" });
  });

  it("missing both: creates exactly one row per key", async () => {
    await deleteSyntheticRows();
    const result = await ensureCatalogueReferenceDisciplines(SYNTHETIC_DISCIPLINES);
    expect(result.created.sort()).toEqual([TEST_KEY_A, TEST_KEY_B].sort());
    expect(result.alreadyExisted).toEqual([]);

    const rows = await prisma.masterDiscipline.findMany({ where: { key: { in: [TEST_KEY_A, TEST_KEY_B] } } });
    expect(rows).toHaveLength(2);
  });

  it("one already existing: creates only the missing one, never overwrites the existing row", async () => {
    await deleteSyntheticRows();
    const preExisting = await prisma.masterDiscipline.create({
      data: { key: TEST_KEY_A, name: "Original Name — must survive", description: "Original description — must survive.", icon: "original-icon" },
    });

    const result = await ensureCatalogueReferenceDisciplines(SYNTHETIC_DISCIPLINES);
    expect(result.created).toEqual([TEST_KEY_B]);
    expect(result.alreadyExisted).toEqual([TEST_KEY_A]);

    const unchanged = await prisma.masterDiscipline.findUniqueOrThrow({ where: { key: TEST_KEY_A } });
    expect(unchanged.id).toBe(preExisting.id);
    expect(unchanged.name).toBe("Original Name — must survive");
    expect(unchanged.description).toBe("Original description — must survive.");
    expect(unchanged.icon).toBe("original-icon");

    const rows = await prisma.masterDiscipline.findMany({ where: { key: { in: [TEST_KEY_A, TEST_KEY_B] } } });
    expect(rows).toHaveLength(2);
  });

  it("both already existing: creates neither — safe, idempotent rerun", async () => {
    await deleteSyntheticRows();
    await ensureCatalogueReferenceDisciplines(SYNTHETIC_DISCIPLINES);
    const beforeRows = await prisma.masterDiscipline.findMany({ where: { key: { in: [TEST_KEY_A, TEST_KEY_B] } }, orderBy: { key: "asc" } });

    const result = await ensureCatalogueReferenceDisciplines(SYNTHETIC_DISCIPLINES);
    expect(result.created).toEqual([]);
    expect(result.alreadyExisted.sort()).toEqual([TEST_KEY_A, TEST_KEY_B].sort());

    const afterRows = await prisma.masterDiscipline.findMany({ where: { key: { in: [TEST_KEY_A, TEST_KEY_B] } }, orderBy: { key: "asc" } });
    expect(afterRows.map((r) => r.id)).toEqual(beforeRows.map((r) => r.id)); // exact same rows, not recreated
  });

  it("real interior-fit-out and landscaping keys: safe to run against the actual production list without arguments", async () => {
    // This exercises the exact default path applyCatalogueReferenceDisciplinesMigration()
    // uses, against whatever the current local DB state actually is — always safe/
    // idempotent (never deletes or recreates existing rows) so it never disturbs the
    // real interior-fit-out/landscaping rows other tests and the local dev seed rely on.
    const result = await ensureCatalogueReferenceDisciplines();
    expect(result.created.length + result.alreadyExisted.length).toBe(REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.length);

    const rows = await prisma.masterDiscipline.findMany({
      where: { key: { in: REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.map((d) => d.key) } },
      select: { key: true },
    });
    expect(rows.map((r) => r.key).sort()).toEqual(REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.map((d) => d.key).sort());
  });

  it("every active registered dataset's required MasterDiscipline key is covered by real reference data after this migration", async () => {
    await ensureCatalogueReferenceDisciplines(); // real keys — always safe, see test above
    const datasets = listDatasetDefinitions().filter((d) => d.active && d.approved);
    const requiredKeys = new Set(datasets.map((d) => d.disciplineAliases?.[d.disciplineKey] ?? d.disciplineKey));

    const existing = await prisma.masterDiscipline.findMany({ where: { key: { in: Array.from(requiredKeys) } }, select: { key: true } });
    const existingKeys = new Set(existing.map((e) => e.key));

    const missing = Array.from(requiredKeys).filter((k) => !existingKeys.has(k));
    expect(missing, `MasterDiscipline keys missing for active registered datasets: ${missing.join(", ")}`).toEqual([]);
  });
});
