import { getAiDraftExtractedEntityId } from "@/lib/guidance/ai-draft-boq";

const ACTIVE_ENTITY_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"]);

export type AiDraftCoverageEntity = { id: string; label: string; status: string };
export type AiDraftCoverageItem = {
  sourceReference?: string | null;
  quantityProvenance?: { extractedEntityId?: string | null } | null;
};

/** Shared no-silent-omission rule used by both TAYQAN and autonomous preparation. */
export function evaluateAiDraftEntityCoverage(
  entities: readonly AiDraftCoverageEntity[],
  items: readonly AiDraftCoverageItem[],
) {
  const usableEntities = entities.filter((entity) =>
    ACTIVE_ENTITY_STATUSES.has(entity.status)
    && entity.label.trim().length > 0,
  );
  const representedEntityIds = new Set(
    items
      .map((item) => item.quantityProvenance?.extractedEntityId
        ?? getAiDraftExtractedEntityId(item.sourceReference))
      .filter((id): id is string => id !== null && id !== undefined),
  );
  const missingEntityIds = usableEntities
    .filter((entity) => !representedEntityIds.has(entity.id))
    .map((entity) => entity.id);

  return {
    eligibleEntityCount: usableEntities.length,
    representedEntityCount: representedEntityIds.size,
    missingEntityIds,
  };
}
