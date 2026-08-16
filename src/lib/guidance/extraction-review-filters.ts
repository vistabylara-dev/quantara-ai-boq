export type ExtractionReviewPriority = "SAFE" | "REVIEW" | "CRITICAL";
export type ExtractionReviewPriorityFilter = "ALL" | ExtractionReviewPriority;
export type ExtractionReviewConfidenceFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
export type ExtractionReviewDataIssueFilter = "ALL" | "MISSING_QUANTITY" | "MISSING_UNIT";

export type FilterableExtractionEntity = {
  id: string;
  projectFileId: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  extractionMethod: string;
  sourceText?: string | null;
  tableEvidence?: readonly unknown[];
  status: string;
};

export type ExtractionReviewFilters = {
  search: string;
  priority: ExtractionReviewPriorityFilter;
  confidence: ExtractionReviewConfidenceFilter;
  status: string;
  sourceFileId: string;
  entityType: string;
  extractionMethod: string;
  dataIssue: ExtractionReviewDataIssueFilter;
};

export const DEFAULT_EXTRACTION_REVIEW_FILTERS: ExtractionReviewFilters = {
  search: "",
  priority: "ALL",
  confidence: "ALL",
  status: "ALL",
  sourceFileId: "ALL",
  entityType: "ALL",
  extractionMethod: "ALL",
  dataIssue: "ALL",
};

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function hasValidPositiveQuantity(quantity: number | null): boolean {
  return quantity !== null && Number.isFinite(quantity) && quantity > 0;
}

function hasRetainedEvidence(entity: FilterableExtractionEntity): boolean {
  return Boolean(entity.sourceText?.trim()) || Boolean(entity.tableEvidence?.length);
}

function isReviewableStatus(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "EXTRACTED" || normalized === "NEEDS_REVIEW";
}

export function getExtractionReviewPriority(entity: FilterableExtractionEntity): ExtractionReviewPriority {
  if (
    isBlank(entity.label)
    || !hasValidPositiveQuantity(entity.quantity)
    || isBlank(entity.unit)
    || !Number.isFinite(entity.confidence)
    || entity.confidence < 85
  ) {
    return "CRITICAL";
  }

  if (
    entity.status.trim().toUpperCase() === "NEEDS_REVIEW"
    || entity.confidence < 95
    || !hasRetainedEvidence(entity)
  ) {
    return "REVIEW";
  }

  return "SAFE";
}

export function getExtractionConfidenceBand(
  entity: FilterableExtractionEntity,
): Exclude<ExtractionReviewConfidenceFilter, "ALL"> {
  if (!Number.isFinite(entity.confidence) || entity.confidence < 85) return "LOW";
  if (entity.confidence < 95) return "MEDIUM";
  return "HIGH";
}

export function hasExtractionDataIssue(
  entity: FilterableExtractionEntity,
  issue: Exclude<ExtractionReviewDataIssueFilter, "ALL">,
): boolean {
  if (issue === "MISSING_QUANTITY") return !hasValidPositiveQuantity(entity.quantity);
  return isBlank(entity.unit);
}

export function filterExtractionReviewEntities<T extends FilterableExtractionEntity>(
  entities: readonly T[],
  filters: ExtractionReviewFilters,
): T[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return entities.filter((entity) => {
    if (filters.priority !== "ALL") {
      if (!isReviewableStatus(entity.status)) return false;
      if (getExtractionReviewPriority(entity) !== filters.priority) return false;
    }
    if (filters.confidence !== "ALL" && getExtractionConfidenceBand(entity) !== filters.confidence) return false;
    if (filters.status !== "ALL" && entity.status !== filters.status) return false;
    if (filters.sourceFileId !== "ALL" && entity.projectFileId !== filters.sourceFileId) return false;
    if (filters.entityType !== "ALL" && entity.entityType !== filters.entityType) return false;
    if (filters.extractionMethod !== "ALL" && entity.extractionMethod !== filters.extractionMethod) return false;
    if (filters.dataIssue !== "ALL" && !hasExtractionDataIssue(entity, filters.dataIssue)) return false;

    if (normalizedSearch) {
      const searchable = [
        entity.label,
        entity.entityType,
        entity.unit ?? "",
        entity.extractionMethod,
        entity.status,
      ].join(" ").toLowerCase();
      if (!searchable.includes(normalizedSearch)) return false;
    }

    return true;
  });
}

export function uniqueExtractionFilterValues(
  values: readonly (string | null | undefined)[],
): string[] {
  return [...new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  )].sort((left, right) => left.localeCompare(right));
}
