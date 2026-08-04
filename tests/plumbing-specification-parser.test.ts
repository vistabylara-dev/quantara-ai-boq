import { describe, expect, it } from "vitest";
import { parsePlumbingSpecification } from "../src/lib/imports/plumbing-specification-parser";

describe("CATALOGUE-CLOSE: parsePlumbingSpecification", () => {
  it("extracts subcategory, summary, MasterFormat, and OmniClass table code, and ignores the CSI reference URL", () => {
    const raw =
      "Subcategory: Compressed Air | Supply, install, joint, support, identify, test and commission Aluminum Modular Air Pipe 45 degree elbow for compressed air, nominal size band 15-25 mm, complete with compatible fittings, jointing materials and accessories. | Code Ref: 22 61 13 / OmniClass Table 23 (indicative) | CSI: https://crmservice.csinet.org/widgets/masterformat/numbersandtitles.aspx | Spec: Working Pressure: ___ | Air Quality Class: ___ | Pipe Standard: ___ | Joint Type: ___";
    const result = parsePlumbingSpecification(raw);
    expect(result.subcategory).toBe("Compressed Air");
    expect(result.summary).toBe("Supply, install, joint, support, identify, test and commission Aluminum Modular Air Pipe 45 degree elbow for compressed air, nominal size band 15-25 mm, complete with compatible fittings, jointing materials and accessories.");
    expect(result.masterFormatCode).toBe("22 61 13");
    expect(result.omniClassCode).toBe("Table 23");
    expect(result.specificationTemplate).toBe("Working Pressure: ___ | Air Quality Class: ___ | Pipe Standard: ___ | Joint Type: ___");
    expect(result.warnings).toHaveLength(0);
  });

  it("never stores the CSI URL as a classification value", () => {
    const raw = "Subcategory: X | Sentence. | Code Ref: 22 00 00 / OmniClass Table 22 (indicative) | CSI: https://crmservice.csinet.org/widgets/masterformat/numbersandtitles.aspx | Spec: A: ___";
    const result = parsePlumbingSpecification(raw);
    expect(JSON.stringify(result)).not.toContain("csinet.org");
  });

  it("flags a missing Subcategory prefix instead of guessing one", () => {
    const raw = "Sentence without a subcategory prefix. | Code Ref: 22 00 00 / OmniClass Table 22 (indicative) | Spec: A: ___";
    const result = parsePlumbingSpecification(raw);
    expect(result.subcategory).toBe("");
    expect(result.warnings).toContain("SUBCATEGORY_MISSING");
  });

  it("flags an unrecognized Code Ref shape instead of guessing a split point", () => {
    const raw = "Subcategory: X | Sentence. | Code Ref: not-a-recognized-shape | Spec: A: ___";
    const result = parsePlumbingSpecification(raw);
    expect(result.masterFormatCode).toBe("not-a-recognized-shape");
    expect(result.omniClassCode).toBeNull();
    expect(result.warnings).toContain("CODE_REF_UNEXPECTED_FORMAT");
  });

  it("handles an empty specification field without throwing", () => {
    const result = parsePlumbingSpecification("");
    expect(result.warnings).toEqual(["EMPTY_SPECIFICATION"]);
  });
});
