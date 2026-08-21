import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chooseAiDraftSection,
  formatAiDraftCategory,
  getAiDraftExtractedEntityId,
  getAiDraftQuantityValue,
  isAiDraftCandidateUsable,
  isAiDraftMeasurementComplete,
  summarizeAiDraftCandidates,
  type AiDraftCandidate,
} from "../src/lib/guidance/ai-draft-boq";

function candidate(overrides: Partial<AiDraftCandidate> = {}): AiDraftCandidate {
  return {
    id: "entity-1",
    entityType: "BOQ_ITEM",
    label: "Chilled water pipe 100mm",
    quantity: 240,
    unit: "m",
    confidence: 96,
    sourceText: "HVAC chilled water schedule",
    status: "EXTRACTED",
    ...overrides,
  };
}

describe("AI Draft BOQ workflow", () => {
  it("allows usable unreviewed or reviewed extraction into an AI Draft", () => {
    expect(isAiDraftCandidateUsable(candidate({ status: "EXTRACTED" }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ status: "NEEDS_REVIEW" }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ status: "CONFIRMED" }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ status: "CORRECTED" }))).toBe(true);
  });

  it("allows incomplete measurements into the draft without treating them as complete", () => {
    expect(isAiDraftCandidateUsable(candidate({ quantity: null }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ quantity: 0 }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ unit: null }))).toBe(true);
    expect(isAiDraftCandidateUsable(candidate({ unit: " " }))).toBe(true);

    expect(isAiDraftMeasurementComplete(candidate({ quantity: null }))).toBe(false);
    expect(isAiDraftMeasurementComplete(candidate({ quantity: 0 }))).toBe(false);
    expect(isAiDraftMeasurementComplete(candidate({ unit: null }))).toBe(false);
    expect(isAiDraftMeasurementComplete(candidate({ unit: " " }))).toBe(false);
    expect(isAiDraftMeasurementComplete(candidate())).toBe(true);

    // Preserve valid extracted evidence field-by-field.
    expect(getAiDraftQuantityValue(candidate({ quantity: 240, unit: null }))).toBe(240);
    expect(getAiDraftQuantityValue(candidate({ quantity: null, unit: "m" }))).toBe(0);
    expect(getAiDraftQuantityValue(candidate({ quantity: -5, unit: "m" }))).toBe(0);
  });

  it("keeps rejected and already imported extraction out of new draft generation", () => {
    expect(isAiDraftCandidateUsable(candidate({ status: "REJECTED" }))).toBe(false);
    expect(isAiDraftCandidateUsable(candidate({ status: "IMPORTED" }))).toBe(false);
  });

  it("summarizes draftable, measurement-incomplete, skipped, and finalized extraction separately", () => {
    expect(summarizeAiDraftCandidates([
      candidate({ id: "complete" }),
      candidate({ id: "missing-unit", unit: null }),
      candidate({ id: "missing-quantity", quantity: null }),
      candidate({ id: "missing-label", label: " " }),
      candidate({ id: "rejected", status: "REJECTED" }),
    ])).toEqual({
      eligibleCount: 3,
      measurementIncompleteCount: 2,
      skippedCount: 1,
      ignoredFinalizedCount: 1,
    });
  });

  it("keeps the extraction link recoverable after BOQ quantity provenance becomes manual", () => {
    const entityId = "123e4567-e89b-42d3-a456-426614174000";

    expect(getAiDraftExtractedEntityId(
      `DWG-A12 | EXTRACTED_ENTITY:${entityId}`,
    )).toBe(entityId);

    expect(getAiDraftExtractedEntityId("DWG-A12")).toBeNull();
  });

  it("uses a matching project BOQ section", () => {
    expect(chooseAiDraftSection(
      [
        { id: "hvac", code: "HVAC", title: "HVAC Works", description: "Chilled water and air conditioning" },
        { id: "electrical", code: "ELEC", title: "Electrical Works", description: "Power and lighting" },
      ],
      candidate(),
    )).toBe("hvac");
  });

  it("falls back instead of forcing an unrelated industry section", () => {
    expect(chooseAiDraftSection(
      [
        { id: "electrical", code: "ELEC", title: "Electrical Works", description: "Power and lighting" },
      ],
      candidate({ label: "Ceramic wall tile", entityType: "FINISH", sourceText: "Bathroom tile schedule" }),
    )).toBeNull();

    expect(formatAiDraftCategory("MEP_ITEM")).toBe("Mep Item");
  });

  it("preserves the reviewed-import rule and leaves AI Draft rates unverified", () => {
    const reviewedImport = readFileSync(
      "src/lib/services/extraction-to-boq-service.ts",
      "utf8",
    );
    const aiDraft = readFileSync(
      "src/lib/services/ai-draft-boq-service.ts",
      "utf8",
    );

    expect(reviewedImport).toContain(
      "Only confirmed or corrected entities may be imported to a BOQ.",
    );
    expect(aiDraft).toContain("RateProvenanceSource.LEGACY_UNVERIFIED");
    expect(aiDraft).toContain("AI draft - rate selection pending");
    expect(aiDraft).toContain("new Prisma.Decimal(getAiDraftQuantityValue(candidate))");
    expect(aiDraft).toContain('const unit = candidate.unit?.trim() ?? ""');
    expect(aiDraft).toContain("ENTITY_IMPORTED_TO_BOQ");
  });

  it("keeps unresolved measurements blocked from final BOQ integrity", () => {
    const boqRepository = readFileSync(
      "src/lib/repositories/boq-repository.ts",
      "utf8",
    );

    expect(boqRepository).toContain("BOQ_ITEM_INVALID_UNIT");
    expect(boqRepository).toContain("BOQ_ITEM_INVALID_QUANTITY");
    expect(boqRepository).toContain("ESTIMATE_INTEGRITY_REQUIRED");
  });

  it("allows a delegated worker to pin the target BOQ and frozen source-file scope", () => {
    const service = readFileSync(
      "src/lib/services/ai-draft-boq-service.ts",
      "utf8",
    );

    expect(service).toContain("targetBoqId?: string");
    expect(service).toContain("projectFileIds?: readonly string[]");
    expect(service).toContain("AI_DRAFT_SOURCE_SCOPE_EMPTY");
    expect(service).toContain("AI_DRAFT_BOQ_PROJECT_MISMATCH");
    expect(service).toContain("projectFileId: { in: scopedProjectFileIds }");
  });
  it("exposes all three post-extraction choices and BOQ-level confirmation", () => {
    const extractionPage = readFileSync(
      "src/app/projects/[projectId]/extractions/page.tsx",
      "utf8",
    );
    const boqPage = readFileSync(
      "src/app/projects/[projectId]/boq/page.tsx",
      "utf8",
    );

    expect(extractionPage).toContain("Generate Draft BOQ Now");
    expect(extractionPage).toContain("Review Exceptions First");
    expect(extractionPage).toContain("Review Everything First");
    expect(boqPage).toContain("Confirm Remaining Draft Quantities");
  });
});
