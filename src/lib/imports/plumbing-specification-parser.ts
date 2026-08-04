/**
 * CATALOGUE-CLOSE — the plumbing CSVs (data-imports/plumbing/*.csv) encode
 * their composite specification field differently from the HVAC CSVs (see
 * hvac-specification-parser.ts): a leading "Subcategory:" segment, a
 * combined "Code Ref: <MasterFormat code> / OmniClass <table>" segment, and
 * a "CSI:" segment that is a reference URL to the CSI numbering standard
 * website — not a code — and must never be stored as a classification
 * value. Verified against all 13,111 rows across all 13 plumbing source
 * files: 100% consistent shape (see CATALOGUE-CLOSE audit).
 */

export type ParsedPlumbingSpecification = {
  subcategory: string;
  summary: string;
  masterFormatCode: string | null;
  omniClassCode: string | null;
  specificationTemplate: string;
  warnings: string[];
};

const SUBCATEGORY_LABEL = "Subcategory:";
const CODE_REF_LABEL = "Code Ref:";
const SPEC_LABEL = "Spec:";
const CODE_REF_PATTERN = /^(\d{2}\s\d{2}\s\d{2})\s*\/\s*OmniClass\s+(Table\s+\d+)(?:\s*\(indicative\))?$/;

export function parsePlumbingSpecification(raw: string | null | undefined): ParsedPlumbingSpecification {
  const warnings: string[] = [];
  const text = (raw ?? "").trim();

  if (!text) {
    return { subcategory: "", summary: "", masterFormatCode: null, omniClassCode: null, specificationTemplate: "", warnings: ["EMPTY_SPECIFICATION"] };
  }

  const parts = text.split("|").map((part) => part.trim());
  let cursor = 0;

  let subcategory = "";
  if (parts[0]?.startsWith(SUBCATEGORY_LABEL)) {
    subcategory = parts[0].slice(SUBCATEGORY_LABEL.length).trim();
    cursor = 1;
    if (!subcategory) warnings.push("SUBCATEGORY_LABEL_EMPTY");
  } else {
    warnings.push("SUBCATEGORY_MISSING");
  }

  const summary = parts[cursor] ?? "";

  const codeRefIndex = parts.findIndex((part) => part.startsWith(CODE_REF_LABEL));
  const specIndex = parts.findIndex((part) => part.startsWith(SPEC_LABEL));

  let masterFormatCode: string | null = null;
  let omniClassCode: string | null = null;
  if (codeRefIndex >= 0) {
    const value = parts[codeRefIndex].slice(CODE_REF_LABEL.length).trim();
    const match = value.match(CODE_REF_PATTERN);
    if (match) {
      masterFormatCode = match[1];
      omniClassCode = match[2];
    } else if (value) {
      masterFormatCode = value;
      warnings.push("CODE_REF_UNEXPECTED_FORMAT");
    } else {
      warnings.push("CODE_REF_LABEL_EMPTY");
    }
  } else {
    warnings.push("CODE_REF_MISSING");
  }

  let specificationTemplate = "";
  if (specIndex >= 0) {
    const joined = parts.slice(specIndex).join(" | ");
    specificationTemplate = joined.replace(new RegExp(`^${SPEC_LABEL}\\s*`), "").trim();
    if (!specificationTemplate) warnings.push("SPEC_TEMPLATE_EMPTY");
  } else {
    warnings.push("SPEC_TEMPLATE_MISSING");
  }

  return { subcategory, summary, masterFormatCode, omniClassCode, specificationTemplate, warnings };
}
