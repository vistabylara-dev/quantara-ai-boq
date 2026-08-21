import { describe, expect, it } from "vitest";
import {
  extractTableFieldEvidence,
  extractTableNumericEvidence,
} from "../src/lib/files/table-extraction/numeric-evidence";

describe("structured table evidence", () => {
  it("keeps every non-empty row field with its full human header and exposes a numeric-looking subset", () => {
    const technicalData = {
      rawData: {
        type: "F1",
        r_c_c_dimensions_cm_l: "160",
        r_c_c_dimensions_cm_b: "120",
        r_c_c_dimensions_cm_d: "35",
        reinforcement_bottom_steel_long_span: "T12@20cm",
        reinforcement_top_steel_long_span: "----",
        notes: "300kN",
      },
      headerTitles: {
        type: "Type",
        r_c_c_dimensions_cm_l: "R.C.C Dimensions (cm) > L",
        r_c_c_dimensions_cm_b: "R.C.C Dimensions (cm) > B",
        r_c_c_dimensions_cm_d: "R.C.C Dimensions (cm) > D",
        reinforcement_bottom_steel_long_span: "Reinforcement > Bottom Steel > Long Span",
        reinforcement_top_steel_long_span: "Reinforcement > Top Steel > Long Span",
        notes: "Notes / Load",
      },
    };

    const all = extractTableFieldEvidence(technicalData);
    expect(all).toHaveLength(7);
    expect(all.find((entry) => entry.rawValue === "160")?.fieldTitle)
      .toBe("R.C.C Dimensions (cm) > L");
    expect(all.find((entry) => entry.rawValue === "T12@20cm")?.fieldTitle)
      .toBe("Reinforcement > Bottom Steel > Long Span");

    const numeric = extractTableNumericEvidence(technicalData);
    expect(numeric.some((entry) => entry.rawValue === "160")).toBe(true);
    expect(numeric.some((entry) => entry.rawValue === "T12@20cm")).toBe(true);
    expect(numeric.some((entry) => entry.rawValue === "F1")).toBe(false);
  });
});
