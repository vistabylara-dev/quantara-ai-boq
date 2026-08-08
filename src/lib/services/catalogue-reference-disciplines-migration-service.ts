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
 *
 * When running inside a transaction (db !== the module-level prisma
 * singleton, i.e. a Prisma.TransactionClient), each create() attempt is
 * wrapped in its own SAVEPOINT. Postgres aborts an entire transaction on
 * any statement error — including a P2002 that application code catches —
 * so without the SAVEPOINT, a caught "already exists" on the first
 * discipline would poison the transaction and make every later statement
 * (the next create(), the verification query, applyCatalogueReferenceDisciplinesMigration's
 * own _prisma_migrations INSERT) fail with 25P02 "current transaction is
 * aborted", even though the P2002 itself was expected and handled. This
 * does not change the create()-then-catch(P2002) decision logic or its
 * created/alreadyExisted outputs — it only keeps the surrounding
 * transaction healthy when that decision lands on "already exists".
 */
export async function ensureCatalogueReferenceDisciplines(
  disciplines: ReadonlyArray<{ key: string; name: string; description: string; icon: string }> = REQUIRED_CATALOGUE_REFERENCE_DISCIPLINES,
  db: DbClient = prisma,
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];
  const runningInsideTransaction = db !== prisma;

  for (const d of disciplines) {
    if (runningInsideTransaction) {
      await db.$executeRaw`SAVEPOINT ensure_discipline`;
    }
    try {
      await db.masterDiscipline.create({ data: { key: d.key, name: d.name, description: d.description, icon: d.icon } });
      created.push(d.key);
      if (runningInsideTransaction) {
        await db.$executeRaw`RELEASE SAVEPOINT ensure_discipline`;
      }
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        if (runningInsideTransaction) {
          await db.$executeRaw`ROLLBACK TO SAVEPOINT ensure_discipline`;
        }
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
 * Putting the SELECT inside a transaction alone does not serialize the
 * "missing row" decision under Postgres's default READ COMMITTED isolation
 * — two concurrent transactions can both run the SELECT before either has
 * committed, both see no row, and both proceed to insert. LOCK TABLE
 * "_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE closes that window: the
 * second caller blocks on the lock until the first caller's transaction
 * commits (or rolls back), then re-runs the SELECT and correctly observes
 * the first caller's committed row. ensureCatalogueReferenceDisciplines's
 * own create()-then-catch-P2002 pattern independently makes the discipline
 * rows themselves race-safe even without this lock; this lock exists
 * specifically for the migration-history bookkeeping.
 *
 * Explicit maxWait/timeout: Prisma's interactive-transaction defaults
 * (maxWait 2000ms, timeout 5000ms) are sized for uncontended transactions.
 * Here a second caller can legitimately block on the LOCK TABLE for as
 * long as the first caller's whole critical section takes, so the
 * defaults risk the second caller timing out with an error instead of
 * cleanly observing alreadyApplied once the first caller commits.
 */
export async function applyCatalogueReferenceDisciplinesMigration(): Promise<{ alreadyApplied: boolean; log: string[] }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE`;

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
  }, { maxWait: 15_000, timeout: 30_000 });
}
