/**
 * CATALOGUE-ACTIVATE-2 — shared specification parser for every
 * data-imports/** dataset that is neither HVAC nor Plumbing (those two keep
 * their own bespoke parsers — hvac-specification-parser.ts,
 * plumbing-specification-parser.ts — since their composite field encodes
 * differently). All 13 other discovered folders were spot-checked across
 * every folder (12 sampled files, one per folder) and share one consistent
 * shape:
 *
 *   {description} | Code Ref: {code} [/ {code2 or "OmniClass " table}] | Spec: {Field}: ___ | {Field2}: ___ | ... [| Remarks: ...]
 *
 * Unlike plumbing's format, there is no leading "Subcategory:" segment —
 * the composite field starts directly with the descriptive sentence. This
 * has only been verified against a small sample per folder (one row each),
 * not the full ~170,000 rows those 13 folders contain — the real dry-run
 * pass (CATALOGUE-ACTIVATE-3) will surface any row that doesn't match this
 * shape as a per-row warning rather than a hard failure, exactly as the
 * existing bulk-import engine already does for HVAC/Plumbing.
 */

import { MasterClassificationSystem } from "@prisma/client";
import type { ParsedSpecification } from "@/lib/services/master-catalogue-bulk-import-service";

export type ParsedGenericSpecification = {
  summary: string;
  masterFormatCode: string | null;
  secondaryCode: string | null;
  secondaryCodeSystem: "MASTERFORMAT_2020" | "OMNICLASS" | null;
  specificationTemplate: string;
  warnings: string[];
};

const CODE_REF_LABEL = "Code Ref:";
const SPEC_LABEL = "Spec:";
const MASTERFORMAT_CODE = /^(\d{2}\s\d{2}\s\d{2})$/;
// "08 44 13 / OmniClass 23-17 13 21" or "05 05 19 / 03 15 00"
const CODE_REF_PATTERN = /^(\d{2}\s\d{2}\s\d{2})\s*\/\s*(?:(OmniClass)\s+([\w-]+(?:\s[\w-]+)*)|(\d{2}\s\d{2}\s\d{2}))$/;

export function parseGenericCodeRefSpecification(raw: string | null | undefined): ParsedGenericSpecification {
  const warnings: string[] = [];
  const text = (raw ?? "").trim();

  if (!text) {
    return { summary: "", masterFormatCode: null, secondaryCode: null, secondaryCodeSystem: null, specificationTemplate: "", warnings: ["EMPTY_SPECIFICATION"] };
  }

  const parts = text.split("|").map((part) => part.trim());
  const summary = parts[0] ?? "";
  if (!summary) warnings.push("SUMMARY_EMPTY");

  const codeRefIndex = parts.findIndex((part) => part.startsWith(CODE_REF_LABEL));
  const specIndex = parts.findIndex((part) => part.startsWith(SPEC_LABEL));

  let masterFormatCode: string | null = null;
  let secondaryCode: string | null = null;
  let secondaryCodeSystem: "MASTERFORMAT_2020" | "OMNICLASS" | null = null;

  if (codeRefIndex >= 0) {
    const value = parts[codeRefIndex].slice(CODE_REF_LABEL.length).trim();
    const match = value.match(CODE_REF_PATTERN);
    if (match) {
      masterFormatCode = match[1];
      if (match[2] === "OmniClass") {
        secondaryCode = match[3];
        secondaryCodeSystem = "OMNICLASS";
      } else if (match[4]) {
        secondaryCode = match[4];
        secondaryCodeSystem = "MASTERFORMAT_2020";
      }
    } else if (MASTERFORMAT_CODE.test(value)) {
      masterFormatCode = value;
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

  return { summary, masterFormatCode, secondaryCode, secondaryCodeSystem, specificationTemplate, warnings };
}

/** Adapts the generic parser's output to the shape master-catalogue-bulk-import-service.ts's BulkImportProfile expects. */
export function toParsedSpecification(parsed: ParsedGenericSpecification): ParsedSpecification {
  const classifications: ParsedSpecification["classifications"] = [];
  if (parsed.masterFormatCode) classifications.push({ system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsed.masterFormatCode, isPrimary: true });
  if (parsed.secondaryCode && parsed.secondaryCodeSystem) {
    classifications.push({ system: MasterClassificationSystem[parsed.secondaryCodeSystem], code: parsed.secondaryCode });
  }
  return {
    fullDescription: parsed.summary,
    specificationTemplate: parsed.specificationTemplate,
    subcategory: null,
    classifications,
    warnings: parsed.warnings,
  };
}
