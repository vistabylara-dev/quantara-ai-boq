import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/lib/i18n/dictionaries/en";

describe("reviewed extraction to BOQ UI bridge", () => {
  const modal = readFileSync(
    path.resolve(__dirname, "../src/components/boq/add-item-from-source-modal.tsx"),
    "utf8",
  );
  const boqPage = readFileSync(
    path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
    "utf8",
  );
  const extractionPage = readFileSync(
    path.resolve(__dirname, "../src/app/projects/[projectId]/extractions/page.tsx"),
    "utf8",
  );

  it("exposes only professionally reviewed extraction for BOQ import", () => {
    expect(modal).toContain('"reviewed" | "search" | "manual"');
    expect(modal).toContain('entity.status === "CONFIRMED" || entity.status === "CORRECTED"');
    expect(modal).toContain('t("boqEditor.reviewedInfoDescription")');
    expect(en.boqEditor.reviewedInfoDescription).toContain("Nothing is imported automatically");
  });

  it("uses the governed extraction import route rather than generic source copying", () => {
    expect(modal).toContain("/extractions/import-to-boq");
    expect(modal).toContain("entityId: selectedEntity.id");
    expect(modal).toContain("quantityCalculationId");
  });

  it("supports direct reviewed quantities and optional extracted-entity calculations", () => {
    expect(modal).toContain('t("boqEditor.useCalculationInsteadHelp")');
    expect(en.boqEditor.useCalculationInsteadHelp).toContain("Schedule/count quantities do not require a dimensional calculation");
    expect(modal).toContain("extractedEntityId={selectedEntity.id}");
    expect(modal).toContain("confirmedExtractionCalculation.id");
    expect(modal).toContain("selectedEntity.sourceText");
  });

  it("connects completed extraction review directly to the BOQ import workspace", () => {
    expect(extractionPage).toContain("/boq?action=import-reviewed");
    expect(boqPage).toContain('action === "import-reviewed"');
    expect(boqPage).toContain('setAddItemInitialTab("reviewed")');
    expect(boqPage).toContain("initialTab={addItemInitialTab}");
  });
});
