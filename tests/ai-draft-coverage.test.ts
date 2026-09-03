import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAiDraftEntityCoverage } from "../src/lib/guidance/ai-draft-coverage";

describe("shared AI draft scope coverage", () => {
  it("accepts provenance and source markers but reports every missing usable entity", () => {
    const entities = [
      { id: "10000000-0000-4000-8000-000000000001", label: "Gross floor area", status: "NEEDS_REVIEW" },
      { id: "10000000-0000-4000-8000-000000000002", label: "Room count", status: "EXTRACTED" },
      { id: "10000000-0000-4000-8000-000000000003", label: " ", status: "EXTRACTED" },
    ];
    const covered = evaluateAiDraftEntityCoverage(entities, [
      { quantityProvenance: { extractedEntityId: entities[0]!.id } },
      { sourceReference: `A-101 | EXTRACTED_ENTITY:${entities[1]!.id}` },
    ]);
    expect(covered).toEqual({
      eligibleEntityCount: 2,
      representedEntityCount: 2,
      missingEntityIds: [],
    });

    expect(evaluateAiDraftEntityCoverage(entities, []).missingEntityIds).toEqual([
      entities[0]!.id,
      entities[1]!.id,
    ]);
  });

  it("assembles the concept review schedule before applying payable blockers", () => {
    const source = readFileSync(path.join(
      process.cwd(),
      "src/lib/jobs/autonomous-boq-preparation-handler.ts",
    ), "utf8");
    const assemblyIndex = source.indexOf("const assembly = await dependencies.assemble");
    const blockerIndex = source.indexOf('payableEligibility = conceptClassifications.length > 0');

    expect(source).toContain("Preliminary Concept Quantity Schedule — Not for Contract/Payment");
    expect(source).toContain("CONCEPT_SCHEDULE_METRIC:");
    expect(source).toContain('"SCOPE_COVERAGE_INCOMPLETE"');
    expect(assemblyIndex).toBeGreaterThan(-1);
    expect(blockerIndex).toBeGreaterThan(assemblyIndex);
  });
});
