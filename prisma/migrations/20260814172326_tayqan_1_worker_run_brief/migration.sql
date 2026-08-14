-- TAYQAN-1 — additive only. Persists the hiring user's assignment brief
-- (objective + special instructions) on WorkerRun at hire time. Never
-- updated afterward; the bounded AI planner never reads these fields.
--
-- NOTE: prisma migrate dev's auto-diff also generated several unrelated,
-- destructive statements here that this migration deliberately excludes:
--   - DROP CONSTRAINT on 7 existing foreign keys across
--     BOQItemQuantityProvenance, BOQItemRateProvenance,
--     BOQRevisionItemEvidence, and WorkerMaterialQuestion — pre-existing
--     schema drift between the live database and this schema.prisma's
--     relation annotations, unrelated to this change. Dropping real
--     foreign keys on unrelated tables as a side effect of an additive
--     column addition would be a genuinely destructive, out-of-scope
--     change and was removed.
--   - DROP INDEX on the three MasterItem pg_trgm/GIN search indexes,
--     the same recurring auto-diff artifact documented on every other
--     migration in this repo that touches an unrelated table (see
--     20260810195100_stripe_commercial_checkout's own header comment).
-- Both classes of statement were verified as unrelated to this change and
-- removed before applying.

-- AlterTable
ALTER TABLE "WorkerRun" ADD COLUMN     "assignmentObjective" TEXT,
ADD COLUMN     "specialInstructions" TEXT;
