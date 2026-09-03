import { describe, expect, it } from "vitest";
import { missingAutonomousBoqSections } from "../src/lib/services/ai-draft-boq-service";

describe("autonomous BOQ section reconciliation", () => {
  it("adds each frozen-policy section once without duplicating existing sections", () => {
    expect(missingAutonomousBoqSections(
      [{ code: "ARE" }],
      [
        { sectionCode: "ARE", title: "Measured Areas" },
        { sectionCode: "OPN", title: "Doors and Windows" },
        { sectionCode: "OPN", title: "Doors and Windows" },
        { sectionCode: "SPC", title: "Room and Space Schedules" },
      ],
    )).toEqual([
      { code: "OPN", title: "Doors and Windows" },
      { code: "SPC", title: "Room and Space Schedules" },
    ]);
  });
});
