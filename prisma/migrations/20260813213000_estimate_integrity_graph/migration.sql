-- Estimate Integrity Graph — Phase 4
--
-- Current editable BOQ values receive separate relational quantity and rate
-- provenance. Locking a verified revision freezes both links in immutable
-- revision rows. Existing rows are retained honestly as LEGACY_UNVERIFIED;
-- the application only treats newly confirmed provenance as lockable.

CREATE TYPE "QuantityProvenanceSource" AS ENUM (
  'MANUAL_CONFIRMED',
  'CONFIRMED_CALCULATION',
  'REVIEWED_EXTRACTION',
  'COPIED',
  'LEGACY_UNVERIFIED'
);

CREATE TYPE "RateProvenanceSource" AS ENUM (
  'MANUAL_CONFIRMED',
  'MIXED_CONFIRMED',
  'RATE_CATALOGUE',
  'COMPANY_LIBRARY',
  'PREVIOUS_BOQ',
  'IMPORT',
  'MASTER_ITEM',
  'COPIED',
  'LEGACY_UNVERIFIED'
);

CREATE TABLE "BOQItemQuantityProvenance" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "boqItemId" UUID NOT NULL,
  "sourceType" "QuantityProvenanceSource" NOT NULL,
  "extractedEntityId" UUID,
  "quantityCalculationId" UUID,
  "projectFileId" UUID,
  "sourceBoqItemQuantityProvenanceId" UUID,
  "quantitySnapshot" DECIMAL(18,6) NOT NULL,
  "unitSnapshot" TEXT NOT NULL,
  "confirmedByUserId" UUID,
  "confirmedByName" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BOQItemQuantityProvenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BOQItemRateProvenance" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "boqItemId" UUID NOT NULL,
  "sourceType" "RateProvenanceSource" NOT NULL,
  "rateCatalogueItemId" UUID,
  "sourceBoqItemRateProvenanceId" UUID,
  "unitCostSnapshot" DECIMAL(18,4) NOT NULL,
  "freightCostSnapshot" DECIMAL(18,4) NOT NULL,
  "installationCostSnapshot" DECIMAL(18,4) NOT NULL,
  "additionalCostSnapshot" DECIMAL(18,4) NOT NULL,
  "marginModeSnapshot" "MarginMode" NOT NULL,
  "marginPercentageSnapshot" DECIMAL(7,4) NOT NULL,
  "currencySnapshot" TEXT NOT NULL DEFAULT 'AED',
  "sourceEffectiveDate" TIMESTAMP(3),
  "sourceExpiryDate" TIMESTAMP(3),
  "confirmedByUserId" UUID,
  "confirmedByName" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BOQItemRateProvenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BOQRevisionItemEvidence" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "boqRevisionSnapshotId" UUID NOT NULL,
  "boqItemId" UUID NOT NULL,
  "quantityProvenanceId" UUID NOT NULL,
  "rateProvenanceId" UUID NOT NULL,
  "itemCodeSnapshot" TEXT NOT NULL,
  "quantitySnapshot" DECIMAL(18,6) NOT NULL,
  "unitSnapshot" TEXT NOT NULL,
  "unitCostSnapshot" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BOQRevisionItemEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BOQItemQuantityProvenance_boqItemId_key" ON "BOQItemQuantityProvenance"("boqItemId");
CREATE INDEX "BOQItemQuantityProvenance_companyId_projectId_idx" ON "BOQItemQuantityProvenance"("companyId", "projectId");
CREATE INDEX "BOQItemQuantityProvenance_extractedEntityId_idx" ON "BOQItemQuantityProvenance"("extractedEntityId");
CREATE INDEX "BOQItemQuantityProvenance_quantityCalculationId_idx" ON "BOQItemQuantityProvenance"("quantityCalculationId");
CREATE INDEX "BOQItemQuantityProvenance_projectFileId_idx" ON "BOQItemQuantityProvenance"("projectFileId");
CREATE INDEX "BOQItemQuantityProvenance_sourceBoqItemQuantityProvenanceId_idx" ON "BOQItemQuantityProvenance"("sourceBoqItemQuantityProvenanceId");

CREATE UNIQUE INDEX "BOQItemRateProvenance_boqItemId_key" ON "BOQItemRateProvenance"("boqItemId");
CREATE INDEX "BOQItemRateProvenance_companyId_projectId_idx" ON "BOQItemRateProvenance"("companyId", "projectId");
CREATE INDEX "BOQItemRateProvenance_rateCatalogueItemId_idx" ON "BOQItemRateProvenance"("rateCatalogueItemId");
CREATE INDEX "BOQItemRateProvenance_sourceBoqItemRateProvenanceId_idx" ON "BOQItemRateProvenance"("sourceBoqItemRateProvenanceId");

CREATE UNIQUE INDEX "BOQRevisionItemEvidence_boqRevisionSnapshotId_boqItemId_key" ON "BOQRevisionItemEvidence"("boqRevisionSnapshotId", "boqItemId");
CREATE INDEX "BOQRevisionItemEvidence_companyId_projectId_idx" ON "BOQRevisionItemEvidence"("companyId", "projectId");
CREATE INDEX "BOQRevisionItemEvidence_boqItemId_idx" ON "BOQRevisionItemEvidence"("boqItemId");
CREATE INDEX "BOQRevisionItemEvidence_quantityProvenanceId_idx" ON "BOQRevisionItemEvidence"("quantityProvenanceId");
CREATE INDEX "BOQRevisionItemEvidence_rateProvenanceId_idx" ON "BOQRevisionItemEvidence"("rateProvenanceId");

ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_extractedEntityId_fkey" FOREIGN KEY ("extractedEntityId") REFERENCES "ExtractedEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_quantityCalculationId_fkey" FOREIGN KEY ("quantityCalculationId") REFERENCES "QuantityCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_source_fkey" FOREIGN KEY ("sourceBoqItemQuantityProvenanceId") REFERENCES "BOQItemQuantityProvenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemQuantityProvenance" ADD CONSTRAINT "BOQItemQuantityProvenance_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_rateCatalogueItemId_fkey" FOREIGN KEY ("rateCatalogueItemId") REFERENCES "RateCatalogueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_source_fkey" FOREIGN KEY ("sourceBoqItemRateProvenanceId") REFERENCES "BOQItemRateProvenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQItemRateProvenance" ADD CONSTRAINT "BOQItemRateProvenance_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_snapshot_fkey" FOREIGN KEY ("boqRevisionSnapshotId") REFERENCES "BOQRevisionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_quantityProvenanceId_fkey" FOREIGN KEY ("quantityProvenanceId") REFERENCES "BOQItemQuantityProvenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOQRevisionItemEvidence" ADD CONSTRAINT "BOQRevisionItemEvidence_rateProvenanceId_fkey" FOREIGN KEY ("rateProvenanceId") REFERENCES "BOQItemRateProvenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve pre-migration truth without manufacturing confirmations.
INSERT INTO "BOQItemQuantityProvenance" (
  "id", "companyId", "projectId", "boqItemId", "sourceType",
  "quantitySnapshot", "unitSnapshot", "confirmedByName", "confirmedAt",
  "createdAt", "updatedAt"
)
SELECT item."id", item."companyId", boq."projectId", item."id",
       'LEGACY_UNVERIFIED'::"QuantityProvenanceSource",
       item."quantity", item."unit", 'Legacy data - confirmation unavailable', NULL,
       item."createdAt", item."updatedAt"
FROM "BOQItem" item
JOIN "BOQSection" section ON section."id" = item."sectionId"
JOIN "BOQ" boq ON boq."id" = section."boqId";

INSERT INTO "BOQItemRateProvenance" (
  "id", "companyId", "projectId", "boqItemId", "sourceType",
  "unitCostSnapshot", "freightCostSnapshot", "installationCostSnapshot",
  "additionalCostSnapshot", "marginModeSnapshot", "marginPercentageSnapshot",
  "currencySnapshot", "confirmedByName", "confirmedAt", "createdAt", "updatedAt"
)
SELECT item."id", item."companyId", boq."projectId", item."id",
       'LEGACY_UNVERIFIED'::"RateProvenanceSource",
       item."unitCost", item."freightCost", item."installationCost",
       item."additionalCost", item."marginMode", item."marginPercentage",
       'AED', 'Legacy data - confirmation unavailable', NULL,
       item."createdAt", item."updatedAt"
FROM "BOQItem" item
JOIN "BOQSection" section ON section."id" = item."sectionId"
JOIN "BOQ" boq ON boq."id" = section."boqId";

INSERT INTO "BOQRevisionItemEvidence" (
  "id", "companyId", "projectId", "boqRevisionSnapshotId", "boqItemId",
  "quantityProvenanceId", "rateProvenanceId", "itemCodeSnapshot",
  "quantitySnapshot", "unitSnapshot", "unitCostSnapshot", "createdAt"
)
SELECT gen_random_uuid(), snapshot."companyId", snapshot."projectId", snapshot."id",
       item."id", quantity_provenance."id", rate_provenance."id",
       snapshot_item.value->>'itemCode',
       (snapshot_item.value->>'quantity')::DECIMAL(18,6),
       snapshot_item.value->>'unit',
       (snapshot_item.value->>'unitCost')::DECIMAL(18,4),
       snapshot."createdAt"
FROM "BOQRevisionSnapshot" snapshot
JOIN LATERAL jsonb_array_elements(snapshot."snapshotJson"->'sections') snapshot_section(value) ON TRUE
JOIN LATERAL jsonb_array_elements(snapshot_section.value->'items') snapshot_item(value) ON TRUE
JOIN "BOQItem" item ON item."id" = (snapshot_item.value->>'id')::UUID
JOIN "BOQItemQuantityProvenance" quantity_provenance ON quantity_provenance."boqItemId" = item."id"
JOIN "BOQItemRateProvenance" rate_provenance ON rate_provenance."boqItemId" = item."id";

CREATE FUNCTION "enforce_boq_item_quantity_provenance"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "BOQItem" item
  JOIN "BOQSection" section ON section."id" = item."sectionId"
  JOIN "BOQ" boq ON boq."id" = section."boqId"
  WHERE item."id" = NEW."boqItemId"
    AND item."companyId" = NEW."companyId"
    AND section."companyId" = NEW."companyId"
    AND boq."companyId" = NEW."companyId"
    AND boq."projectId" = NEW."projectId"
    AND item."quantity" = NEW."quantitySnapshot"
    AND item."unit" = NEW."unitSnapshot";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quantity provenance must match the BOQ item tenant, project, quantity and unit.' USING ERRCODE = '23514';
  END IF;

  IF NEW."sourceType" = 'LEGACY_UNVERIFIED' AND NEW."confirmedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy-unverified quantity provenance cannot be confirmed implicitly.' USING ERRCODE = '23514';
  ELSIF NEW."sourceType" <> 'LEGACY_UNVERIFIED' AND NEW."confirmedAt" IS NULL THEN
    RAISE EXCEPTION 'Governed quantity provenance requires explicit confirmation.' USING ERRCODE = '23514';
  END IF;

  IF NEW."sourceType" = 'REVIEWED_EXTRACTION' THEN
    IF NEW."extractedEntityId" IS NULL OR NEW."projectFileId" IS NULL THEN
      RAISE EXCEPTION 'Reviewed extraction quantity provenance requires entity and source file.' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM "ExtractedEntity"
      WHERE "id" = NEW."extractedEntityId"
        AND "companyId" = NEW."companyId"
        AND "projectId" = NEW."projectId"
        AND "projectFileId" = NEW."projectFileId"
        AND "status" IN ('CONFIRMED', 'CORRECTED', 'IMPORTED');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reviewed extraction lineage does not match confirmed source evidence.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."quantityCalculationId" IS NOT NULL THEN
    PERFORM 1 FROM "QuantityCalculation"
      WHERE "id" = NEW."quantityCalculationId"
        AND "companyId" = NEW."companyId"
        AND "projectId" = NEW."projectId"
        AND "status" = 'CONFIRMED'
        AND (NEW."extractedEntityId" IS NULL OR "extractedEntityId" = NEW."extractedEntityId")
        AND ROUND("resultValue", 4) = NEW."quantitySnapshot"
        AND "resultUnit" = NEW."unitSnapshot";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quantity calculation lineage or result does not match the BOQ quantity.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."sourceType" = 'COPIED' AND NEW."sourceBoqItemQuantityProvenanceId" IS NULL THEN
    RAISE EXCEPTION 'Copied quantity provenance requires a source provenance row.' USING ERRCODE = '23514';
  END IF;
  IF NEW."sourceBoqItemQuantityProvenanceId" IS NOT NULL THEN
    PERFORM 1 FROM "BOQItemQuantityProvenance"
      WHERE "id" = NEW."sourceBoqItemQuantityProvenanceId"
        AND "companyId" = NEW."companyId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Copied quantity provenance crosses tenant boundaries.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQItemQuantityProvenance_lineage_guard"
BEFORE INSERT OR UPDATE ON "BOQItemQuantityProvenance"
FOR EACH ROW EXECUTE FUNCTION "enforce_boq_item_quantity_provenance"();

CREATE FUNCTION "enforce_boq_item_rate_provenance"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "BOQItem" item
  JOIN "BOQSection" section ON section."id" = item."sectionId"
  JOIN "BOQ" boq ON boq."id" = section."boqId"
  WHERE item."id" = NEW."boqItemId"
    AND item."companyId" = NEW."companyId"
    AND section."companyId" = NEW."companyId"
    AND boq."companyId" = NEW."companyId"
    AND boq."projectId" = NEW."projectId"
    AND item."unitCost" = NEW."unitCostSnapshot"
    AND item."freightCost" = NEW."freightCostSnapshot"
    AND item."installationCost" = NEW."installationCostSnapshot"
    AND item."additionalCost" = NEW."additionalCostSnapshot"
    AND item."marginMode" = NEW."marginModeSnapshot"
    AND item."marginPercentage" = NEW."marginPercentageSnapshot";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rate provenance must match the BOQ item tenant, project and commercial values.' USING ERRCODE = '23514';
  END IF;

  IF NEW."sourceType" = 'LEGACY_UNVERIFIED' AND NEW."confirmedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy-unverified rate provenance cannot be confirmed implicitly.' USING ERRCODE = '23514';
  ELSIF NEW."sourceType" <> 'LEGACY_UNVERIFIED' AND NEW."confirmedAt" IS NULL THEN
    RAISE EXCEPTION 'Governed rate provenance requires explicit confirmation.' USING ERRCODE = '23514';
  END IF;

  IF NEW."sourceType" = 'RATE_CATALOGUE' AND NEW."rateCatalogueItemId" IS NULL THEN
      RAISE EXCEPTION 'Catalogue rate provenance requires a catalogue item.' USING ERRCODE = '23514';
  END IF;
  IF NEW."rateCatalogueItemId" IS NOT NULL THEN
    PERFORM 1 FROM "RateCatalogueItem"
      WHERE "id" = NEW."rateCatalogueItemId" AND "companyId" = NEW."companyId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Catalogue rate provenance crosses tenant boundaries.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."sourceType" IN ('PREVIOUS_BOQ', 'COPIED') AND NEW."sourceBoqItemRateProvenanceId" IS NULL THEN
    RAISE EXCEPTION 'Copied rate provenance requires a source provenance row.' USING ERRCODE = '23514';
  END IF;
  IF NEW."sourceBoqItemRateProvenanceId" IS NOT NULL THEN
    PERFORM 1 FROM "BOQItemRateProvenance"
      WHERE "id" = NEW."sourceBoqItemRateProvenanceId"
        AND "companyId" = NEW."companyId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Copied rate provenance crosses tenant boundaries.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQItemRateProvenance_lineage_guard"
BEFORE INSERT OR UPDATE ON "BOQItemRateProvenance"
FOR EACH ROW EXECUTE FUNCTION "enforce_boq_item_rate_provenance"();

CREATE FUNCTION "protect_frozen_boq_item_provenance"() RETURNS TRIGGER AS $$
DECLARE
  evidence_id UUID;
  locked BOOLEAN;
BEGIN
  evidence_id := OLD."id";
  IF TG_TABLE_NAME = 'BOQItemQuantityProvenance' THEN
    PERFORM 1 FROM "BOQRevisionItemEvidence" WHERE "quantityProvenanceId" = evidence_id;
  ELSE
    PERFORM 1 FROM "BOQRevisionItemEvidence" WHERE "rateProvenanceId" = evidence_id;
  END IF;
  IF FOUND THEN
    RAISE EXCEPTION 'Issued BOQ item provenance is immutable.' USING ERRCODE = '23514';
  END IF;

  SELECT boq."isLocked" INTO locked
  FROM "BOQItem" item
  JOIN "BOQSection" section ON section."id" = item."sectionId"
  JOIN "BOQ" boq ON boq."id" = section."boqId"
  WHERE item."id" = OLD."boqItemId";
  IF locked THEN
    RAISE EXCEPTION 'Locked BOQ item provenance is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQItemQuantityProvenance_frozen_guard"
BEFORE UPDATE OR DELETE ON "BOQItemQuantityProvenance"
FOR EACH ROW EXECUTE FUNCTION "protect_frozen_boq_item_provenance"();

CREATE TRIGGER "BOQItemRateProvenance_frozen_guard"
BEFORE UPDATE OR DELETE ON "BOQItemRateProvenance"
FOR EACH ROW EXECUTE FUNCTION "protect_frozen_boq_item_provenance"();

CREATE FUNCTION "enforce_revision_item_evidence"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "BOQRevisionSnapshot" snapshot
  JOIN "BOQSection" section ON section."boqId" = snapshot."boqId"
  JOIN "BOQItem" item ON item."sectionId" = section."id" AND item."id" = NEW."boqItemId"
  JOIN "BOQItemQuantityProvenance" quantity_provenance
    ON quantity_provenance."id" = NEW."quantityProvenanceId" AND quantity_provenance."boqItemId" = item."id"
  JOIN "BOQItemRateProvenance" rate_provenance
    ON rate_provenance."id" = NEW."rateProvenanceId" AND rate_provenance."boqItemId" = item."id"
  WHERE snapshot."id" = NEW."boqRevisionSnapshotId"
    AND snapshot."companyId" = NEW."companyId"
    AND snapshot."projectId" = NEW."projectId"
    AND item."companyId" = NEW."companyId"
    AND quantity_provenance."companyId" = NEW."companyId"
    AND rate_provenance."companyId" = NEW."companyId"
    AND quantity_provenance."projectId" = NEW."projectId"
    AND rate_provenance."projectId" = NEW."projectId"
    AND item."itemCode" = NEW."itemCodeSnapshot"
    AND item."quantity" = NEW."quantitySnapshot"
    AND item."unit" = NEW."unitSnapshot"
    AND item."unitCost" = NEW."unitCostSnapshot";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision evidence must match its snapshot, BOQ item and provenance graph.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQRevisionItemEvidence_lineage_guard"
BEFORE INSERT ON "BOQRevisionItemEvidence"
FOR EACH ROW EXECUTE FUNCTION "enforce_revision_item_evidence"();

CREATE FUNCTION "protect_revision_item_evidence"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Issued revision item evidence is immutable.' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQRevisionItemEvidence_immutable"
BEFORE UPDATE OR DELETE ON "BOQRevisionItemEvidence"
FOR EACH ROW EXECUTE FUNCTION "protect_revision_item_evidence"();

CREATE FUNCTION "protect_linked_boq_revision_snapshot"() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "BOQRevisionItemEvidence" WHERE "boqRevisionSnapshotId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'BOQ revision snapshot with issued evidence is immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BOQRevisionSnapshot_evidence_immutable"
BEFORE UPDATE OR DELETE ON "BOQRevisionSnapshot"
FOR EACH ROW EXECUTE FUNCTION "protect_linked_boq_revision_snapshot"();
