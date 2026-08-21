-- MASTER-SCALE-1A: search scalability foundation.
--
-- Prefix/typo-tolerant search across 150,000-300,000 rows is not viable
-- with plain `LIKE '%term%'` (a full sequential scan). pg_trgm + GIN gives
-- fast substring/prefix/fuzzy matching without needing a separate search
-- service yet. This is intentionally the minimum needed now: real
-- relevance ranking, synonym expansion, and autocomplete-as-you-type at
-- the top end of the target range still call for a dedicated search
-- engine (see the "Search scalability assessment" in the MASTER-SCALE-1A
-- report) — not built here, since 44 rows do not require it and building
-- it now would be premature for the current data volume.
--
-- Not represented in schema.prisma (Prisma has no first-class pg_trgm/GIN
-- support without a preview feature this project doesn't enable) — future
-- `prisma migrate dev` runs diff against the schema file only and will not
-- attempt to drop these, the same accepted pattern used elsewhere for
-- database objects outside Prisma's DSL.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "MasterItem_name_trgm_idx" ON "MasterItem" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "MasterItem_itemCode_trgm_idx" ON "MasterItem" USING GIN ("itemCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "MasterItem_shortDescription_trgm_idx" ON "MasterItem" USING GIN ("shortDescription" gin_trgm_ops);