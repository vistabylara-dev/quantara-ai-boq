-- Note: `prisma migrate dev` also generated three unrelated `DROP INDEX`
-- statements for MasterItem_*_trgm_idx here, from the same pre-existing
-- drift between schema.prisma and migration history documented in
-- 20260812114554_add_table_page_resolution/migration.sql. Removed so this
-- migration stays purely additive to the "My Items" feature it's for.

-- CreateIndex
CREATE INDEX "CompanyLibraryItem_createdByUserId_idx" ON "CompanyLibraryItem"("createdByUserId");
