-- CATALOGUE-INTEGRITY-REPAIR — additive-only, idempotent insertion of the
-- two MasterDiscipline reference rows that data-imports/architectural-finishes
-- and data-imports/landscaping require (disciplineKey "interior-fit-out" and
-- "landscaping"). Both have existed in prisma/seed-data/master-data.ts since
-- that file's first commit, but no production migration ever inserted
-- MasterDiscipline rows — every migration touching that table is schema-only
-- DDL; the only code path that ever writes discipline reference data is
-- prisma/seed.ts, a dev-only bootstrap never run by `prisma migrate deploy`.
-- Values are taken verbatim from master-data.ts — never invented here.
-- ON CONFLICT ("key") DO NOTHING makes this safe to apply more than once and
-- guarantees it never overwrites a row that already exists.

INSERT INTO "MasterDiscipline" ("id", "key", "name", "description", "icon", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'interior-fit-out', 'Interior Fit-Out', 'Interior fit-out and finishing works.', 'layout', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'landscaping', 'Landscaping', 'Soft and hard landscaping works.', 'tree', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
