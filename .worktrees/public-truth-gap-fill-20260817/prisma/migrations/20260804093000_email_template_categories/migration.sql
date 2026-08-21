-- Email service 1B follow-up: template categories (BOQ / TECHNICAL_REPORT / GENERAL).
-- Additive only. Existing EmailTemplate rows backfill to 'BOQ' (they are, in fact, all BOQ
-- proposal templates today) via the column DEFAULT applying at ADD COLUMN time.

CREATE TYPE "EmailTemplateCategory" AS ENUM ('BOQ', 'TECHNICAL_REPORT', 'GENERAL');

ALTER TABLE "EmailTemplate" ADD COLUMN "category" "EmailTemplateCategory" NOT NULL DEFAULT 'BOQ';
