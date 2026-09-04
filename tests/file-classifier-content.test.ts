import { ProjectFileClassification } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { classifyProjectFile } from "../src/lib/files/file-classifier";

describe("rendered drawing content classification", () => {
  it("classifies a generically named valid IFC drawing from extracted page text", () => {
    const result = classifyProjectFile({
      originalName: "quantara-positive-fixture.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      contentText: [
        "ISSUED FOR CONSTRUCTION (IFC)",
        "GROUND FLOOR PLAN AND AREA SCHEDULE",
        "GROSS FLOOR AREA 78.00 m2",
        "NET FLOOR AREA 72.00 m2",
        "ROOM SCHEDULE ROOM COUNT 3",
      ].join("\n"),
    });

    expect(result).toMatchObject({
      classification: ProjectFileClassification.ARCHITECTURAL_PLAN,
      method: "content-heuristic",
    });
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(result.matchedSignals).toEqual(expect.arrayContaining([
      "floor plan",
      "gross floor area",
      "net floor area",
      "room schedule",
    ]));
  });

  it("keeps content without recognized drawing evidence unknown", () => {
    expect(classifyProjectFile({
      originalName: "generic.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      contentText: "GENERAL NOTES ONLY",
    })).toMatchObject({
      classification: ProjectFileClassification.UNKNOWN,
      confidence: 0,
      method: "content-heuristic",
    });
  });
});
