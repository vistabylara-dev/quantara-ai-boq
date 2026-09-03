import { ProjectFileClassification } from "@prisma/client";

export type ClassificationSuggestion = {
  classification: ProjectFileClassification;
  /** 0-100. Filename-only heuristics never claim above 90. */
  confidence: number;
  matchedSignals: string[];
  method: "filename-heuristic" | "content-heuristic";
};

export type ClassifiableFile = {
  originalName: string;
  mimeType: string;
  extension: string;
  /** Text extracted from rendered pages/title blocks. Never populated from the filename. */
  contentText?: string;
};

type Rule = { classification: ProjectFileClassification; keywords: string[] };

/** Controlled keyword signals used first against rendered page text, with a
 * conservative filename-only fallback for sources that have no text layer. */
const RULES: Rule[] = [
  { classification: ProjectFileClassification.STRUCTURAL_PLAN, keywords: ["structural", "struct-plan", "rebar", "reinforcement", "beam layout", "column layout", "foundation plan"] },
  { classification: ProjectFileClassification.ARCHITECTURAL_PLAN, keywords: ["architectural", "arch plan", "arch-plan", "floor plan", "floorplan", "gfa plan", "gross floor area", "net floor area", "room schedule"] },
  { classification: ProjectFileClassification.FURNITURE_LAYOUT, keywords: ["furniture layout", "ffe layout", "furniture-layout"] },
  { classification: ProjectFileClassification.FURNITURE_SCHEDULE, keywords: ["furniture schedule", "ffe schedule", "furniture-schedule"] },
  { classification: ProjectFileClassification.INTERIOR_LAYOUT, keywords: ["interior layout", "interior-layout", "fit-out plan", "fitout plan"] },
  { classification: ProjectFileClassification.REFLECTED_CEILING_PLAN, keywords: ["reflected ceiling", "rcp"] },
  { classification: ProjectFileClassification.FLOORING_PLAN, keywords: ["flooring plan", "floor finish plan"] },
  { classification: ProjectFileClassification.LIGHTING_PLAN, keywords: ["lighting plan", "lighting layout"] },
  { classification: ProjectFileClassification.ELECTRICAL_PLAN, keywords: ["electrical", "power layout", "elec-plan", "single line diagram", " sld "] },
  { classification: ProjectFileClassification.HVAC_PLAN, keywords: ["hvac", "mechanical plan", "ductwork", "ac layout", "ahu layout"] },
  { classification: ProjectFileClassification.PLUMBING_PLAN, keywords: ["plumbing", "water supply plan", "sanitary plan"] },
  { classification: ProjectFileClassification.DRAINAGE_PLAN, keywords: ["drainage", "storm water", "sewer plan"] },
  { classification: ProjectFileClassification.FIRE_FIGHTING_PLAN, keywords: ["fire fighting", "firefighting", "sprinkler layout", "fire suppression"] },
  { classification: ProjectFileClassification.FIRE_ALARM_PLAN, keywords: ["fire alarm", "smoke detector layout", "fa layout"] },
  { classification: ProjectFileClassification.ELV_PLAN, keywords: ["elv layout", "extra low voltage", "cctv layout", "access control layout", "data cabling"] },
  { classification: ProjectFileClassification.JOINERY_DRAWING, keywords: ["joinery", "millwork", "carpentry detail"] },
  { classification: ProjectFileClassification.LANDSCAPE_PLAN, keywords: ["landscape", "planting plan", "irrigation plan"] },
  { classification: ProjectFileClassification.ELEVATION, keywords: ["elevation"] },
  { classification: ProjectFileClassification.SECTION, keywords: ["cross-section", "cross section", "building section"] },
  { classification: ProjectFileClassification.DETAIL_DRAWING, keywords: ["detail drawing", "typical detail", "construction detail"] },
  { classification: ProjectFileClassification.MATERIAL_SCHEDULE, keywords: ["material schedule", "materials schedule"] },
  { classification: ProjectFileClassification.EQUIPMENT_SCHEDULE, keywords: ["equipment schedule", "equipment list"] },
  { classification: ProjectFileClassification.DOOR_SCHEDULE, keywords: ["door schedule"] },
  { classification: ProjectFileClassification.WINDOW_SCHEDULE, keywords: ["window schedule"] },
  { classification: ProjectFileClassification.FINISH_SCHEDULE, keywords: ["finish schedule", "finishes schedule"] },
  { classification: ProjectFileClassification.SUPPLIER_PRICE_LIST, keywords: ["price list", "quotation", "supplier price"] },
  { classification: ProjectFileClassification.EXISTING_BOQ, keywords: ["boq", "bill of quantities", "bill-of-quantities"] },
  { classification: ProjectFileClassification.PRODUCT_CATALOGUE, keywords: ["catalogue", "catalog", "product brochure", "datasheet"] },
  { classification: ProjectFileClassification.SITE_INSPECTION_PHOTO, keywords: ["site photo", "inspection photo"] },
  { classification: ProjectFileClassification.TEST_REPORT, keywords: ["test report", "testing report", "commissioning report"] },
  { classification: ProjectFileClassification.METHOD_STATEMENT, keywords: ["method statement", "method-statement"] },
  { classification: ProjectFileClassification.TECHNICAL_REPORT, keywords: ["technical report", "condition report", "assessment report"] },
];

const BASE_CONFIDENCE = 65;
const CONFIDENCE_PER_EXTRA_MATCH = 15;
const MAX_HEURISTIC_CONFIDENCE = 90;

export function classifyProjectFile(file: ClassifiableFile): ClassificationSuggestion {
  const filenameHaystack = ` ${file.originalName.toLowerCase().replace(/[._-]+/g, " ")} `;
  const contentHaystack = file.contentText?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
  const haystack = contentHaystack || filenameHaystack;

  let best: { classification: ProjectFileClassification; matches: string[] } | null = null;

  for (const rule of RULES) {
    const matches = rule.keywords.filter((keyword) => haystack.includes(keyword));
    if (matches.length === 0) continue;
    if (!best || matches.length > best.matches.length) {
      best = { classification: rule.classification, matches };
    }
  }

  if (!best) {
    return { classification: ProjectFileClassification.UNKNOWN, confidence: 0, matchedSignals: [], method: contentHaystack ? "content-heuristic" : "filename-heuristic" };
  }

  if (contentHaystack) {
    const confidence = Math.min(98, 80 + (best.matches.length - 1) * 6);
    return { classification: best.classification, confidence, matchedSignals: best.matches, method: "content-heuristic" };
  }

  const confidence = Math.min(MAX_HEURISTIC_CONFIDENCE, BASE_CONFIDENCE + (best.matches.length - 1) * CONFIDENCE_PER_EXTRA_MATCH);
  return { classification: best.classification, confidence, matchedSignals: best.matches, method: "filename-heuristic" };
}
