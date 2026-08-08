import { Prisma } from "@prisma/client";
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

type DbClient = typeof prisma | Prisma.TransactionClient;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

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
 *
 * Race-safe by construction: relies on MasterDiscipline.key's real unique DB
 * constraint rather than a check-then-create pattern. create() either
 * succeeds (definitely new) or throws a unique-constraint violation
 * (definitely pre-existing, row left untouched) — no read-then-write window
 * for two concurrent callers to both miss the row and both try to create it.
 * Accepts an optional db client so it can run inside an existing transaction
 * (see applyCatalogueReferenceDisciplinesMigration below) or standalone.
 */
export async function ensureCatalogueReferenceDisciplines(
  disciplines: ReadonlyArray<{ key: string; name: string; description: string; icon: string }> = REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES,
  db: DbClient = prisma,
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const d of disciplines) {
    try {
      await db.masterDiscipline.create({ data: { key: d.key, name: d.name, description: d.description, icon: d.icon } });
      created.push(d.key);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        alreadyExisted.push(d.key);
        continue;
      }
      throw error;
    }
  }

  const verify = await db.masterDiscipline.findMany({
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
 *
 * The _prisma_migrations lookup and the discipline creation + history insert
 * all happen inside one transaction, with the lookup re-checked after the
 * transaction has started — closes the TOCTOU window where two concurrent
 * calls could both see "not yet applied" and both attempt the insert.
 * ensureCatalogueReferenceDisciplines's own create()-then-catch-P2002
 * pattern independently makes the discipline rows themselves race-safe even
 * within that transaction.
 */
export async function applyCatalogueReferenceDisciplinesMigration(): Promise<{ alreadyApplied: boolean; log: string[] }> {
  return prisma.$transaction(async (tx) => {
    const alreadyRecorded = await tx.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME}
    `;
    if (alreadyRecorded.length > 0) {
      return { alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] };
    }

    const log: string[] = [];
    const { created, alreadyExisted } = await ensureCatalogueReferenceDisciplines(REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES, tx);
    for (const key of created) log.push(`Created MasterDiscipline "${key}".`);
    for (const key of alreadyExisted) log.push(`MasterDiscipline "${key}" already exists — skipped.`);
    log.push("Verified both reference disciplines exist.");

    await tx.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
      VALUES (gen_random_uuid()::text, ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_CHECKSUM}, ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME}, now(), now(), 1)
    `;
    log.push(`Recorded ${CATALOGUE_REFERENCE_DISCIPLINES_MIGRATION_NAME} as applied in _prisma_migrations.`);

    return { alreadyApplied: false, log };
  });
}
