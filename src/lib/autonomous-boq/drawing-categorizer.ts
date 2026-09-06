import type { QuantityCalculationType } from "@prisma/client";

export type DrawingScopeDisposition = "PROPOSED" | "EXISTING" | "DEMOLITION" | "OPTIONAL" | "EXCLUDED" | "UNSPECIFIED";
export type DrawingMaturity = "IFC_CONSTRUCTION" | "TENDER" | "DESIGN_DEVELOPMENT" | "CONCEPT_BASIS_OF_DESIGN" | "AS_BUILT" | "UNKNOWN";
export type DrawingPayableStatus = "PAYABLE_ELIGIBLE" | "NOT_PAYABLE_CONCEPT" | "NOT_PAYABLE_AS_BUILT" | "REVIEW_REQUIRED";

export type ControlledCategoryPath = {
  industry: string;
  discipline: string;
  drawingType: string;
  workPackage: string;
  boqSectionCode: string;
  boqSectionTitle: string;
  boqItemClassification: string;
  measurementRuleId: string;
  measurementMethod: "COUNT" | "LINEAR" | "AREA" | "VOLUME" | "WEIGHT" | "OPTIMIZED_SHEET_QUANTITY";
  calculationType: QuantityCalculationType | "SPECIALIZED_SHEET_OPTIMIZATION";
  unit: string;
};

export type DrawingSheetClassification = {
  version: "drawing-categorization-v1";
  pageId: string;
  projectFileId: string;
  pageNumber: number;
  drawingNumber: string | null;
  sheetNumber: string | null;
  revision: string | null;
  levelOrLocation: string | null;
  scopeDisposition: DrawingScopeDisposition;
  maturity: DrawingMaturity;
  payableStatus: DrawingPayableStatus;
  status: "VERIFIED" | "UNCERTAIN" | "UNRESOLVED" | "SUPERSEDED";
  confidence: number;
  categoryPaths: ControlledCategoryPath[];
  alternatives: ControlledCategoryPath[];
  supportingEvidence: Array<{ kind: "TITLE" | "TITLE_BLOCK" | "LEGEND" | "SCHEDULE" | "ANNOTATION" | "SPECIFICATION" | "RELATIONSHIP"; text: string }>;
  supersededByPageId: string | null;
};

export type CategorizerPageInput = {
  id: string;
  projectFileId: string;
  pageNumber: number;
  drawingNumber: string | null;
  revisionNumber: string | null;
  drawingTitle: string | null;
  sheetName: string | null;
  text: string | null;
  drawingTitles: readonly string[];
  technicalLines: readonly string[];
};

export type CategorizerPolicyRule = {
  id: string;
  sectionCode: string;
  title: string;
  calculationType: QuantityCalculationType;
  resultUnit: string;
};

type Definition = {
  engines: readonly string[];
  discipline: string;
  drawingType: string;
  workPackage: string;
  sectionHints: readonly string[];
  item: string;
  ruleHints: readonly string[];
  signals: readonly string[];
  method: ControlledCategoryPath["measurementMethod"];
};

const DEFINITIONS: readonly Definition[] = [
  { engines: ["construction"], discipline: "Structural", drawingType: "Foundation plan", workPackage: "Concrete works", sectionHints: ["foundation"], item: "Reinforced concrete", ruleHints: ["foundation-concrete"], signals: ["foundation", "footing", "reinforced concrete", "concrete"], method: "VOLUME" },
  { engines: ["construction"], discipline: "Civil", drawingType: "Foundation plan", workPackage: "Earthworks", sectionHints: ["foundation"], item: "Foundation excavation", ruleHints: ["foundation-excavation"], signals: ["foundation", "excavation", "formation level"], method: "VOLUME" },
  { engines: ["construction"], discipline: "Structural", drawingType: "Reinforcement schedule", workPackage: "Reinforcement", sectionHints: ["concrete"], item: "Reinforcement steel", ruleHints: ["structural-reinforcement"], signals: ["bar bending schedule", "reinforcement", "rebar", "bar mark"], method: "WEIGHT" },
  { engines: ["construction"], discipline: "Structural", drawingType: "Concrete detail", workPackage: "Formwork", sectionHints: ["formwork"], item: "Exposed concrete formwork", ruleHints: ["structural-formwork"], signals: ["formwork", "shuttering", "concrete face"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Wall layout", workPackage: "Masonry", sectionHints: ["blockwork"], item: "Measured blockwork", ruleHints: ["measured-blockwork"], signals: ["blockwork", "masonry", "wall type"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Area schedule", workPackage: "Area schedules", sectionHints: ["area-schedules"], item: "Gross floor area", ruleHints: ["gross-floor-area"], signals: ["gross floor area", "gross area", "gfa"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Area schedule", workPackage: "Area schedules", sectionHints: ["area-schedules"], item: "Net floor area", ruleHints: ["net-floor-area"], signals: ["net floor area", "net area", "nfa"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Room schedule", workPackage: "Space schedules", sectionHints: ["space-schedules"], item: "Scheduled room", ruleHints: ["room-schedule-count"], signals: ["room schedule", "room count", "space schedule"], method: "COUNT" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Floor-finish plan", workPackage: "Floor finishes", sectionHints: ["floor-finishes"], item: "Floor finish", ruleHints: ["construction-floor-finish-area"], signals: ["floor finish plan", "floor finish schedule", "floor finish"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Reflected ceiling plan", workPackage: "Ceilings", sectionHints: ["ceilings"], item: "Ceiling finish", ruleHints: ["construction-ceiling-area"], signals: ["reflected ceiling plan", "ceiling schedule", "ceiling finish"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Wall-finish plan", workPackage: "Wall finishes", sectionHints: ["wall-finishes"], item: "Wall finish", ruleHints: ["construction-wall-finish-area"], signals: ["wall finish plan", "wall finish schedule", "wall finish"], method: "AREA" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Door/window schedule", workPackage: "Doors and windows", sectionHints: ["openings"], item: "Scheduled door or window", ruleHints: ["door-window-count"], signals: ["door schedule", "window schedule", "door and window schedule"], method: "COUNT" },
  { engines: ["construction"], discipline: "Architectural", drawingType: "Partition layout", workPackage: "Partitions", sectionHints: ["partitions"], item: "Partition", ruleHints: ["construction-partition-area"], signals: ["partition layout", "partition schedule", "partition type"], method: "AREA" },
  { engines: ["construction"], discipline: "Civil", drawingType: "External-works plan", workPackage: "External works", sectionHints: ["external-works"], item: "Measured external works", ruleHints: ["external-works-area"], signals: ["external works plan", "paving schedule", "hardscape plan"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Floor-finish plan", workPackage: "Finishes", sectionHints: ["floor"], item: "Floor finish", ruleHints: ["floor-finish-area"], signals: ["floor finish", "porcelain tile", "flooring", "tile finish"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Reflected ceiling plan", workPackage: "Ceilings", sectionHints: ["ceiling"], item: "Ceiling finish", ruleHints: ["ceiling-finish-area"], signals: ["reflected ceiling", "ceiling finish", "rcp"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Floor-finish plan", workPackage: "Finishes", sectionHints: ["floor"], item: "Skirting", ruleHints: ["skirting-length"], signals: ["skirting", "baseboard"], method: "LINEAR" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Wall-finish plan", workPackage: "Finishes", sectionHints: ["wall"], item: "Wall finish", ruleHints: ["wall-finish-area"], signals: ["wall finish", "wall covering", "wall finish schedule"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Paint-finish plan", workPackage: "Finishes", sectionHints: ["wall"], item: "Painted surface", ruleHints: ["paint-area"], signals: ["paint finish", "paint schedule", "painted surface"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Partition layout", workPackage: "Partitions", sectionHints: ["partition"], item: "Partition", ruleHints: ["partition-area"], signals: ["partition", "gypsum wall", "drywall"], method: "AREA" },
  { engines: ["interior-fitout"], discipline: "Architectural", drawingType: "Demolition plan", workPackage: "Demolition", sectionHints: ["demolition"], item: "Demolition item", ruleHints: ["fitout-item-count"], signals: ["demolition plan", "demolition legend", "remove fixture"], method: "COUNT" },
  { engines: ["electrical", "mep"], discipline: "Electrical", drawingType: "Lighting layout", workPackage: "Lighting fixtures", sectionHints: ["lighting"], item: "LED downlight", ruleHints: ["electrical-point-count", "mep-equipment-count"], signals: ["lighting layout", "led downlight", "luminaire", "lighting legend"], method: "COUNT" },
  { engines: ["electrical", "mep"], discipline: "Electrical", drawingType: "Electrical layout", workPackage: "Distribution", sectionHints: ["distribution"], item: "Electrical circuit", ruleHints: ["electrical-circuit-count"], signals: ["circuit schedule", "distribution board", "single line diagram"], method: "COUNT" },
  { engines: ["electrical", "mep"], discipline: "Electrical", drawingType: "Cable routing plan", workPackage: "Cabling", sectionHints: ["cabling", "electrical"], item: "Cable route", ruleHints: ["electrical-cable-route", "mep-cable-route"], signals: ["cable route", "cable tray", "conduit route"], method: "LINEAR" },
  { engines: ["hvac", "mep"], discipline: "Mechanical", drawingType: "HVAC layout", workPackage: "Ductwork", sectionHints: ["duct", "mechanical"], item: "Rectangular duct", ruleHints: ["hvac-duct-surface", "mep-duct-surface"], signals: ["hvac layout", "rectangular duct", "ductwork", "duct size"], method: "AREA" },
  { engines: ["hvac", "mep"], discipline: "Mechanical", drawingType: "HVAC layout", workPackage: "HVAC equipment", sectionHints: ["equipment", "mechanical"], item: "HVAC equipment", ruleHints: ["hvac-equipment-count", "mep-equipment-count"], signals: ["ahu", "fcu", "air handling unit", "equipment schedule"], method: "COUNT" },
  { engines: ["hvac"], discipline: "Mechanical", drawingType: "HVAC piping plan", workPackage: "HVAC piping", sectionHints: ["piping"], item: "HVAC pipe", ruleHints: ["hvac-pipe-route"], signals: ["hvac piping", "chilled water pipe", "refrigerant pipe"], method: "LINEAR" },
  { engines: ["plumbing", "mep"], discipline: "Plumbing", drawingType: "Water-supply plan", workPackage: "Water supply", sectionHints: ["water", "plumbing"], item: "Water-supply pipe", ruleHints: ["plumbing-pipe-route", "mep-pipe-route"], signals: ["water supply", "pipe route", "cold water", "hot water"], method: "LINEAR" },
  { engines: ["plumbing", "mep"], discipline: "Plumbing", drawingType: "Sanitary layout", workPackage: "Sanitary fixtures", sectionHints: ["sanitary", "plumbing"], item: "Sanitary fixture", ruleHints: ["plumbing-fixture-count", "mep-equipment-count"], signals: ["sanitary fixture", "water closet", "wash basin", "fixture schedule"], method: "COUNT" },
  { engines: ["firefighting", "mep"], discipline: "Fire fighting", drawingType: "Sprinkler layout", workPackage: "Fire protection", sectionHints: ["sprinkler", "fire"], item: "Sprinkler head", ruleHints: ["firefighting-head-count", "mep-equipment-count"], signals: ["sprinkler layout", "sprinkler head", "fire protection legend"], method: "COUNT" },
  { engines: ["firefighting", "mep"], discipline: "Fire fighting", drawingType: "Fire-protection piping plan", workPackage: "Fire protection", sectionHints: ["sprinkler", "fire"], item: "Fire-protection pipe", ruleHints: ["firefighting-pipe-route", "mep-pipe-route"], signals: ["fire fighting pipe", "sprinkler pipe", "fire protection pipe"], method: "LINEAR" },
  { engines: ["landscaping"], discipline: "Landscape", drawingType: "Irrigation plan", workPackage: "Irrigation", sectionHints: ["irrigation"], item: "Irrigation pipe", ruleHints: ["landscape-irrigation-route"], signals: ["irrigation plan", "irrigation pipe", "irrigation route"], method: "LINEAR" },
  { engines: ["landscaping"], discipline: "Landscape", drawingType: "Planting plan", workPackage: "Soft landscape", sectionHints: ["tree", "plant"], item: "Scheduled plant", ruleHints: ["landscape-plant-count"], signals: ["planting plan", "plant schedule", "tree schedule"], method: "COUNT" },
  { engines: ["landscaping"], discipline: "Landscape", drawingType: "Softscape plan", workPackage: "Soft landscape", sectionHints: ["soil"], item: "Softscape coverage", ruleHints: ["landscape-coverage-area"], signals: ["softscape plan", "groundcover area", "lawn area", "planting area"], method: "AREA" },
  { engines: ["landscaping"], discipline: "Landscape", drawingType: "Hardscape plan", workPackage: "Hardscape", sectionHints: ["hardscape"], item: "Hardscape finish", ruleHints: ["landscape-hardscape-area"], signals: ["hardscape plan", "paving area", "external paving", "hard landscape"], method: "AREA" },
  { engines: ["furniture"], discipline: "Furniture", drawingType: "Furniture layout", workPackage: "Furniture units", sectionHints: ["seating"], item: "Furniture unit", ruleHints: ["furniture-unit-count"], signals: ["furniture layout", "furniture schedule", "ffe schedule", "chair type"], method: "COUNT" },
  { engines: ["furniture"], discipline: "Furniture", drawingType: "Furniture layout", workPackage: "Furniture sets", sectionHints: ["workstation"], item: "Furniture set", ruleHints: ["furniture-set-count"], signals: ["furniture set", "workstation cluster", "set quantity"], method: "COUNT" },
];

const JOINERY_DEFINITIONS: readonly Definition[] = [{
  engines: ["joinery"], discipline: "Joinery", drawingType: "Cabinet drawing", workPackage: "Kitchen cabinetry",
  sectionHints: ["board", "cutting"], item: "18 mm panel", ruleHints: ["specialized-sheet-optimization"],
  signals: ["cabinet drawing", "kitchen cabinetry", "18 mm panel", "cutting list", "board material"], method: "OPTIMIZED_SHEET_QUANTITY",
}, {
  engines: ["joinery"], discipline: "Joinery", drawingType: "Cabinet schedule", workPackage: "Joinery units",
  sectionHints: ["cutting"], item: "Joinery unit", ruleHints: ["joinery-unit-count"],
  signals: ["cabinet unit", "joinery unit schedule", "unit multiplicity"], method: "COUNT",
}];

function normalized(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sourceText(page: CategorizerPageInput): string {
  return normalized([page.drawingTitle, page.sheetName, ...page.drawingTitles, ...page.technicalLines, page.text].filter(Boolean).join("\n"));
}

function scopeDisposition(text: string): DrawingScopeDisposition {
  if (/\b(excluded|not in scope|by others)\b/.test(text)) return "EXCLUDED";
  if (/\b(optional|option|alternate)\b/.test(text)) return "OPTIONAL";
  if (/\b(demolition|demolish|remove existing)\b/.test(text)) return "DEMOLITION";
  if (/\b(existing|retain|as built)\b/.test(text)) return "EXISTING";
  if (/\b(proposed|new work|new installation|construction)\b/.test(text)) return "PROPOSED";
  return "UNSPECIFIED";
}

export function classifyDrawingMaturity(textValue: string): DrawingMaturity {
  const text = normalized(textValue);
  if (/\b(as built|record drawing)\b/.test(text)) return "AS_BUILT";
  if (/\b(not for construction|concept|basis of design|schematic design|feasibility)\b/.test(text)) return "CONCEPT_BASIS_OF_DESIGN";
  if (/\b(issued for construction|ifc|construction issue)\b/.test(text)) return "IFC_CONSTRUCTION";
  if (/\b(issued for tender|tender issue|tender drawing)\b/.test(text)) return "TENDER";
  if (/\b(design development|issued for coordination|coordination drawing)\b/.test(text)) return "DESIGN_DEVELOPMENT";
  return "UNKNOWN";
}

function payableStatus(maturity: DrawingMaturity): DrawingPayableStatus {
  if (maturity === "CONCEPT_BASIS_OF_DESIGN") return "NOT_PAYABLE_CONCEPT";
  if (maturity === "AS_BUILT") return "NOT_PAYABLE_AS_BUILT";
  if (maturity === "IFC_CONSTRUCTION" || maturity === "TENDER") return "PAYABLE_ELIGIBLE";
  return "REVIEW_REQUIRED";
}

function revisionCompare(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "", undefined, { numeric: true, sensitivity: "base" });
}

function evidence(page: CategorizerPageInput, definition: Definition): DrawingSheetClassification["supportingEvidence"] {
  const values = [page.drawingTitle, page.sheetName, ...page.drawingTitles, ...page.technicalLines, page.text]
    .filter((value): value is string => Boolean(value));
  const kinds: DrawingSheetClassification["supportingEvidence"][number]["kind"][] = ["TITLE", "TITLE_BLOCK", "TITLE", "ANNOTATION", "SPECIFICATION"];
  return values.flatMap((value, index) => definition.signals.some((signal) => normalized(value).includes(normalized(signal)))
    ? [{ kind: kinds[Math.min(index, kinds.length - 1)]!, text: value.slice(0, 500) }]
    : []).slice(0, 8);
}

function toPath(engineId: string, definition: Definition, rule: CategorizerPolicyRule | null): ControlledCategoryPath {
  return {
    industry: engineId,
    discipline: definition.discipline,
    drawingType: definition.drawingType,
    workPackage: definition.workPackage,
    boqSectionCode: rule?.sectionCode ?? "BOARD_MATERIALS",
    boqSectionTitle: rule?.sectionCode ? rule.title : "Board materials",
    boqItemClassification: definition.item,
    measurementRuleId: rule?.id ?? "specialized-sheet-optimization",
    measurementMethod: definition.method,
    calculationType: rule?.calculationType ?? "SPECIALIZED_SHEET_OPTIMIZATION",
    unit: rule?.resultUnit ?? "sheet",
  };
}

export function categorizeDrawingSheets(input: {
  engineId: string;
  pages: readonly CategorizerPageInput[];
  rules: readonly CategorizerPolicyRule[];
}): DrawingSheetClassification[] {
  const definitions = input.engineId === "joinery"
    ? JOINERY_DEFINITIONS
    : DEFINITIONS.filter((definition) => definition.engines.includes(input.engineId));
  const latestByDrawingNumber = new Map<string, CategorizerPageInput>();
  for (const page of input.pages) {
    const key = normalized(page.drawingNumber);
    if (!key) continue;
    const current = latestByDrawingNumber.get(key);
    if (!current || revisionCompare(current.revisionNumber, page.revisionNumber) < 0) latestByDrawingNumber.set(key, page);
  }

  return input.pages.map((page) => {
    const text = sourceText(page);
    const maturity = classifyDrawingMaturity(text);
    const ranked = definitions.map((definition) => {
      const matched = definition.signals.filter((signal) => text.includes(normalized(signal)));
      const rule = input.rules.find((candidate) => definition.ruleHints.includes(candidate.id))
        ?? input.rules.find((candidate) => definition.sectionHints.some((hint) => normalized(candidate.sectionCode).includes(hint)))
        ?? null;
      return { definition, rule, score: matched.length, path: toPath(input.engineId, definition, rule) };
    }).filter((candidate) => candidate.score > 0 && (candidate.rule !== null || input.engineId === "joinery"))
      .sort((left, right) => right.score - left.score || left.path.measurementRuleId.localeCompare(right.path.measurementRuleId));
    const topScore = ranked[0]?.score ?? 0;
    const minimumScore = maturity === "CONCEPT_BASIS_OF_DESIGN" ? 1 : 2;
    // One coordinated sheet can legitimately contain several independent
    // schedules. Retaining only the highest-scoring definition silently made
    // every other sufficiently evidenced work package unavailable to the
    // measurement gate.
    const primary = ranked.filter((candidate) => candidate.score >= minimumScore);
    const alternatives = ranked.filter((candidate) => candidate.score > 0 && candidate.score < minimumScore).slice(0, 4);
    const drawingKey = normalized(page.drawingNumber);
    const superseding = drawingKey ? latestByDrawingNumber.get(drawingKey) : null;
    const supersededByPageId = superseding && superseding.id !== page.id ? superseding.id : null;
    const disposition = scopeDisposition(text);
    const confidence = Math.min(99, topScore === 0 ? 0 : maturity === "CONCEPT_BASIS_OF_DESIGN" && topScore === 1 ? 80 : 55 + (topScore * 12));
    const ambiguous = primary.length === 0 || confidence < 79;

    return {
      version: "drawing-categorization-v1",
      pageId: page.id,
      projectFileId: page.projectFileId,
      pageNumber: page.pageNumber,
      drawingNumber: page.drawingNumber,
      sheetNumber: page.sheetName,
      revision: page.revisionNumber,
      levelOrLocation: null,
      scopeDisposition: disposition,
      maturity,
      payableStatus: payableStatus(maturity),
      status: supersededByPageId ? "SUPERSEDED" : topScore === 0 ? "UNRESOLVED" : ambiguous ? "UNCERTAIN" : "VERIFIED",
      confidence,
      categoryPaths: ambiguous || supersededByPageId ? [] : primary.map((candidate) => candidate.path),
      alternatives: [...primary, ...alternatives].map((candidate) => candidate.path).slice(0, 4),
      supportingEvidence: ranked[0] ? evidence(page, ranked[0].definition) : [],
      supersededByPageId,
    };
  });
}

export class AutonomousCategorizationBindingError extends Error {}

export function requireMeasurementCategoryBinding(input: {
  workPackage: string;
  evidencePageIds: readonly string[];
  classificationsByPageId: ReadonlyMap<string, DrawingSheetClassification>;
}): ControlledCategoryPath {
  const classifications = input.evidencePageIds.map((pageId) => input.classificationsByPageId.get(pageId)).filter(Boolean) as DrawingSheetClassification[];
  if (classifications.some((classification) => classification.status === "SUPERSEDED")) {
    throw new AutonomousCategorizationBindingError("Measurement evidence includes a superseded drawing revision.");
  }
  if (classifications.some((classification) => classification.payableStatus !== "PAYABLE_ELIGIBLE")) {
    throw new AutonomousCategorizationBindingError("Measurement evidence is not eligible for a payable BOQ at its classified drawing maturity.");
  }
  if (classifications.some((classification) => ["EXISTING", "OPTIONAL", "EXCLUDED"].includes(classification.scopeDisposition))) {
    throw new AutonomousCategorizationBindingError("Measurement evidence is existing, optional or excluded scope and cannot enter the payable BOQ automatically.");
  }
  const matches = classifications.flatMap((classification) => classification.categoryPaths)
    .filter((path) => path.measurementRuleId === input.workPackage);
  if (matches.length === 0) {
    throw new AutonomousCategorizationBindingError("The proposed measurement is not bound to a verified sheet classification and controlled measurement rule.");
  }
  return matches[0]!;
}
