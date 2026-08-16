import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTRACTION_REVIEW_FILTERS,
  filterExtractionReviewEntities,
  getExtractionConfidenceBand,
  getExtractionReviewPriority,
  type FilterableExtractionEntity,
} from "../src/lib/guidance/extraction-review-filters";

function entity(
  overrides: Partial<FilterableExtractionEntity> = {},
): FilterableExtractionEntity {
  return {
    id: "entity-1",
    projectFileId: "file-1",
    entityType: "BOQ_ITEM",
    label: "Concrete slab",
    quantity: 120,
    unit: "m2",
    confidence: 98,
    extractionMethod: "TABLE",
    sourceText: "Concrete slab 120 m2",
    status: "EXTRACTED",
    ...overrides,
  };
}

describe("extraction review filters", () => {
  it("marks complete high-confidence source-linked data as safe", () => {
    expect(getExtractionReviewPriority(entity())).toBe("SAFE");
    expect(getExtractionConfidenceBand(entity())).toBe("HIGH");
  });

  it("marks medium confidence or explicit review state as review", () => {
    expect(getExtractionReviewPriority(entity({ confidence: 91 }))).toBe("REVIEW");
    expect(getExtractionReviewPriority(entity({ status: "NEEDS_REVIEW" }))).toBe("REVIEW");
  });

  it("marks missing quantity, missing unit, or low confidence as critical", () => {
    expect(getExtractionReviewPriority(entity({ quantity: null }))).toBe("CRITICAL");
    expect(getExtractionReviewPriority(entity({ unit: null }))).toBe("CRITICAL");
    expect(getExtractionReviewPriority(entity({ confidence: 70 }))).toBe("CRITICAL");
  });

  it("filters by priority without changing the original entity list", () => {
    const entities = [
      entity({ id: "safe" }),
      entity({ id: "review", confidence: 90 }),
      entity({ id: "critical", quantity: null }),
    ];

    const result = filterExtractionReviewEntities(entities, {
      ...DEFAULT_EXTRACTION_REVIEW_FILTERS,
      priority: "CRITICAL",
    });

    expect(result.map((entry) => entry.id)).toEqual(["critical"]);
    expect(entities).toHaveLength(3);
  });

  it("combines source, method, status, confidence, issue, and text filters", () => {
    const entities = [
      entity({ id: "match", projectFileId: "file-a", label: "Chilled water pipe", extractionMethod: "TABLE" }),
      entity({ id: "wrong-file", projectFileId: "file-b", label: "Chilled water pipe" }),
      entity({ id: "missing-unit", projectFileId: "file-a", label: "Chilled water pipe", unit: null }),
    ];

    const result = filterExtractionReviewEntities(entities, {
      ...DEFAULT_EXTRACTION_REVIEW_FILTERS,
      search: "chilled",
      sourceFileId: "file-a",
      extractionMethod: "TABLE",
      status: "EXTRACTED",
      confidence: "HIGH",
      dataIssue: "ALL",
    });

    expect(result.map((entry) => entry.id)).toEqual(["match", "missing-unit"]);
  });

  it("can focus directly on missing quantity or missing unit", () => {
    const entities = [
      entity({ id: "ok" }),
      entity({ id: "no-qty", quantity: null }),
      entity({ id: "no-unit", unit: null }),
    ];

    expect(filterExtractionReviewEntities(entities, {
      ...DEFAULT_EXTRACTION_REVIEW_FILTERS,
      dataIssue: "MISSING_QUANTITY",
    }).map((entry) => entry.id)).toEqual(["no-qty"]);

    expect(filterExtractionReviewEntities(entities, {
      ...DEFAULT_EXTRACTION_REVIEW_FILTERS,
      dataIssue: "MISSING_UNIT",
    }).map((entry) => entry.id)).toEqual(["no-unit"]);
  });
});
