/**
 * MASTER-SCALE-1B — the staged HVAC CSVs encode MasterFormat / OmniClass /
 * specification-template data as pipe-delimited labeled segments inside a
 * single `specification` text column, e.g.:
 *
 *   "Provide all labor... required for HVAC works. | MasterFormat: 23 00 00
 *    | OmniClass: Table 22 / 23 – HVAC work results/products
 *    | Spec: Scope: ___ | Duration: ___ | Exclusions: ___"
 *
 * This is deterministic extraction (fixed labels, fixed delimiter), not
 * inference — the values already exist in the source text. The `Spec:`
 * segment itself legitimately contains further " | " separators (its own
 * template fields), so it is never split further, only sliced off from the
 * point the `Spec:` label starts to the end of the string.
 *
 * Anything that doesn't match the expected shape is reported in `warnings`
 * rather than guessed at — ambiguous rows must stay reviewable, never
 * silently coerced into a confident value.
 */

export type ParsedHvacSpecification = {
  /** The un-labeled sentence before the first "|" — used as fullDescription. */
  summary: string;
  masterFormatCode: string | null;
  omniClassCode: string | null;
  omniClassLabel: string;
  /** Everything from "Spec:" onward, with the "Spec:" prefix stripped — kept as editable template content (still contains "___" blanks). */
  specificationTemplate: string;
  warnings: string[];
};

const MASTERFORMAT_LABEL = "MasterFormat:";
const OMNICLASS_LABEL = "OmniClass:";
const SPEC_LABEL = "Spec:";

export function parseHvacSpecification(raw: string | null | undefined): ParsedHvacSpecification {
  const warnings: string[] = [];
  const text = (raw ?? "").trim();

  if (!text) {
    return { summary: "", masterFormatCode: null, omniClassCode: null, omniClassLabel: "", specificationTemplate: "", warnings: ["EMPTY_SPECIFICATION"] };
  }

  const parts = text.split("|").map((part) => part.trim());
  const summary = parts[0] ?? "";

  const masterFormatIndex = parts.findIndex((part) => part.startsWith(MASTERFORMAT_LABEL));
  const omniClassIndex = parts.findIndex((part) => part.startsWith(OMNICLASS_LABEL));
  const specIndex = parts.findIndex((part) => part.startsWith(SPEC_LABEL));

  let masterFormatCode: string | null = null;
  if (masterFormatIndex >= 0) {
    const value = parts[masterFormatIndex].slice(MASTERFORMAT_LABEL.length).trim();
    if (value) {
      masterFormatCode = value;
      if (!/^\d{2}\s\d{2}\s\d{2}$/.test(value)) warnings.push("MASTERFORMAT_UNEXPECTED_FORMAT");
    } else {
      warnings.push("MASTERFORMAT_LABEL_EMPTY");
    }
  } else {
    warnings.push("MASTERFORMAT_MISSING");
  }

  let omniClassCode: string | null = null;
  let omniClassLabel = "";
  if (omniClassIndex >= 0) {
    const value = parts[omniClassIndex].slice(OMNICLASS_LABEL.length).trim();
    if (value) {
      // Two observed source formats: "Table 22 / 23 – HVAC work results/products"
      // (en-dash separated) and "23-33 00 00 HVAC Specific Products and Equipment"
      // (bare numeric code directly followed by its label, no separator).
      const tableMatch = value.match(/^(Table\s+[\dA-Za-z/\s]+?)\s*[–-]\s*(.+)$/);
      const numericMatch = value.match(/^(\d{2}-\d{2}\s\d{2}\s\d{2})\s+(.+)$/);
      if (tableMatch) {
        omniClassCode = tableMatch[1].trim();
        omniClassLabel = tableMatch[2].trim();
      } else if (numericMatch) {
        omniClassCode = numericMatch[1].trim();
        omniClassLabel = numericMatch[2].trim();
      } else {
        omniClassCode = value;
        warnings.push("OMNICLASS_UNEXPECTED_FORMAT");
      }
    } else {
      warnings.push("OMNICLASS_LABEL_EMPTY");
    }
  } else {
    warnings.push("OMNICLASS_MISSING");
  }

  let specificationTemplate = "";
  if (specIndex >= 0) {
    const joined = parts.slice(specIndex).join(" | ");
    specificationTemplate = joined.replace(new RegExp(`^${SPEC_LABEL}\\s*`), "").trim();
    if (!specificationTemplate) warnings.push("SPEC_TEMPLATE_EMPTY");
  } else {
    warnings.push("SPEC_TEMPLATE_MISSING");
  }

  return { summary, masterFormatCode, omniClassCode, omniClassLabel, specificationTemplate, warnings };
}
