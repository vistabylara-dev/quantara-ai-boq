import { describe, expect, it } from "vitest";
import { parseHvacSpecification } from "../src/lib/imports/hvac-specification-parser";

describe("MASTER-SCALE-1B: parseHvacSpecification", () => {
  it("extracts MasterFormat, OmniClass (Table format), and the spec template from the composite field", () => {
    const raw =
      "Provide all labor, supervision, temporary facilities, tools and transport required for HVAC works. | MasterFormat: 23 00 00 | OmniClass: Table 22 / 23 – HVAC work results/products | Spec: Scope: ___ | Duration: ___ | Exclusions: ___";
    const result = parseHvacSpecification(raw);
    expect(result.summary).toBe("Provide all labor, supervision, temporary facilities, tools and transport required for HVAC works.");
    expect(result.masterFormatCode).toBe("23 00 00");
    expect(result.omniClassCode).toBe("Table 22 / 23");
    expect(result.omniClassLabel).toBe("HVAC work results/products");
    expect(result.specificationTemplate).toBe("Scope: ___ | Duration: ___ | Exclusions: ___");
    expect(result.warnings).toHaveLength(0);
  });

  it("extracts OmniClass in the bare numeric-code format (no en-dash separator)", () => {
    const raw = "Supply and install engraved or printed identification labels for HVAC equipment. | MasterFormat: 23 05 53 | OmniClass: 23-33 00 00 HVAC Specific Products and Equipment | Spec: Material: ___ | Size: ___ | Text: ___";
    const result = parseHvacSpecification(raw);
    expect(result.omniClassCode).toBe("23-33 00 00");
    expect(result.omniClassLabel).toBe("HVAC Specific Products and Equipment");
    expect(result.warnings).toHaveLength(0);
  });

  it("never splits the Spec segment's own internal pipe-delimited fields into separate top-level segments", () => {
    const raw = "Sentence. | MasterFormat: 23 00 00 | OmniClass: Table 22 – Label | Spec: A: ___ | B: ___ | C: ___";
    const result = parseHvacSpecification(raw);
    expect(result.specificationTemplate).toBe("A: ___ | B: ___ | C: ___");
  });

  it("reports a warning and does not fabricate a value when MasterFormat is missing", () => {
    const raw = "Sentence only, no labeled segments.";
    const result = parseHvacSpecification(raw);
    expect(result.masterFormatCode).toBeNull();
    expect(result.omniClassCode).toBeNull();
    expect(result.specificationTemplate).toBe("");
    expect(result.warnings).toEqual(expect.arrayContaining(["MASTERFORMAT_MISSING", "OMNICLASS_MISSING", "SPEC_TEMPLATE_MISSING"]));
  });

  it("flags an unrecognized OmniClass shape instead of guessing a split point", () => {
    const raw = "Sentence. | MasterFormat: 23 00 00 | OmniClass: something unparseable without a code pattern | Spec: X: ___";
    const result = parseHvacSpecification(raw);
    expect(result.omniClassCode).toBe("something unparseable without a code pattern");
    expect(result.omniClassLabel).toBe("");
    expect(result.warnings).toContain("OMNICLASS_UNEXPECTED_FORMAT");
  });

  it("handles an empty specification field without throwing", () => {
    const result = parseHvacSpecification("");
    expect(result.warnings).toEqual(["EMPTY_SPECIFICATION"]);
    expect(result.masterFormatCode).toBeNull();
  });
});
