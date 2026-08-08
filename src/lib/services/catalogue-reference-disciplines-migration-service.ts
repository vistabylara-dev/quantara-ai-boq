import { prisma } from "@/lib/db/prisma";

/**
 * CATALOGUE-INTEGRITY-REPAIR — the exact two MasterDiscipline reference rows
 * data-imports/architectural-finishes and data-imports/landscaping require,
 * taken verbatim from prisma/seed-data/master-data.ts (never invented here).
 * Never overwrites an existing row — additive only, idempotent, safe to run
 * repeatedly.
 */
export const REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES: ReadonlyArray<{ key: string; name: string; description: string; icon: string }> = [
  { key: "interior-fit-out", name: "Interior Fit-Out", description: "Interior fit-out and finishing works.", icon: "layout" },
  { key: "landscaping", name: "Landscaping", description: "Soft and hard landscaping works.", icon: "tree" },
];

export const CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME = "20260808120000_add_catalogue_reference_disciplines";
export const CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_CHECKSUM = "5b8198a9200264ecbe97a6362c8e1f6b766e1a6c03d89f6751e93a3674497616";

/**
 * The actual additive upsert logic, callable independent of _prisma_migrations
 * bookkeeping so tests can exercise "missing both / one already exists / both
 * already exist" directly against a real database without needing HTTP or
 * platform-owner auth in the way. Never overwrites an existing row: only
 * missing keys are created. Returns which keys were newly created vs already
 * present, and always verifies all required keys exist afterward. Accepts an
 * optional discipline list (defaults to the real production two) so tests
 * can exercise the destructive scenarios against synthetic keys instead of
 * ever touching the real interior-fit-out/landscaping rows other tests and
 * the local dev seed depend on.
 */
export async function ensureCatalogueReferenceDisciplines(
  disciplines: ReadonlyArray<{ key: string; name: string; description: string; icon: string }> = REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES,
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const d of disciplines) {
    const existing = await prisma.masterDiscipline.findUnique({ where: { key: d.key } });
    if (existing) {
      alreadyExisted.push(d.key);
      continue;
    }
    await prisma.masterDiscipline.create({ data: { key: d.key, name: d.name, description: d.description, icon: d.icon } });
    created.push(d.key);
  }

  const verify = await prisma.masterDiscipline.findMany({
    where: { key: { in: disciplines.map((d) => d.key) } },
    select: { key: true },
  });
  if (verify.length !== disciplines.length) {
    throw new Error(`Post-insert verification failed: expected ${disciplines.length} discipline rows, found ${verify.length}.`);
  }

  return { created, alreadyExisted };
}

/**
 * Full break-glass apply: the idempotent upsert above, plus recording the
 * migration as applied in _prisma_migrations (skipped if already recorded).
 * Called by the owner-only route; kept here so the route stays a thin
 * auth+HTTP wrapper, matching this codebase's route/service convention.
 */
export async function applyCatalogueReferenceDisciplinesMigration(): Promise<{ alreadyApplied: boolean; log: string[] }> {
  const log: string[] = [];

  const alreadyRecorded = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME}
  `;
  if (alreadyRecorded.length > 0) {
    return { alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] };
  }

  await prisma.$transaction(async (tx) => {
    for (const d of REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES) {
      const existing = await tx.masterDiscipline.findUnique({ where: { key: d.key } });
      if (existing) {
        log.push(`MasterDiscipline "${d.key}" already exists — skipped.`);
        continue;
      }
      await tx.masterDiscipline.create({ data: { key: d.key, name: d.name, description: d.description, icon: d.icon } });
      log.push(`Created MasterDiscipline "${d.key}".`);
    }

    const verify = await tx.masterDiscipline.findMany({
      where: { key: { in: REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.map((d) => d.key) } },
      select: { key: true },
    });
    if (verify.length !== REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.length) {
      throw new Error(`Post-insert verification failed: expected ${REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES.length} discipline rows, found ${verify.length}.`);
    }
    log.push("Verified both reference disciplines exist.");

    await tx.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
      VALUES (gen_random_uuid()::text, ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_CHECKSUM}, ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME}, now(), now(), 1)
    `;
    log.push(`Recorded ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME} as applied in _prisma_migrations.`);
  });

  return { alreadyApplied: false, log };
}
