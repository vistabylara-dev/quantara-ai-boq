import type { IndustryEngine } from "@/types/industry";

export const constructionEngine: IndustryEngine = {
  id: "construction",
  name: "Construction",
  shortName: "Construction",
  description: "Structural and civil BOQ workflows for building construction projects.",
  icon: "hammer",
  status: "active",
  supportedUnits: ["m3", "m2", "lm", "tonne", "kg", "nos", "LS"],
  boqSections: [
    { id: "preliminaries", code: "PRE", title: "Preliminaries", description: "Site setup and general conditions.", order: 1 },
    { id: "foundations", code: "FND", title: "Foundations", description: "Concrete and reinforcement works.", order: 2 },
    { id: "concrete", code: "CON", title: "Concrete Works", description: "Concrete batching and placement.", order: 3 },
    { id: "formwork", code: "FRM", title: "Formwork", description: "Formwork installation and removal.", order: 4 },
    { id: "blockwork", code: "BLK", title: "Blockwork", description: "Wall construction with block units.", order: 5 },
    { id: "waterproofing", code: "WPF", title: "Waterproofing", description: "Protective waterproof membrane works.", order: 6 },
  ],
  requiredFields: ["concreteGrade", "reinforcementDiameter", "reinforcementWeight", "formworkArea", "elementType", "floorLevel", "structuralReference"],
  calculationTypes: ["concreteVolume", "reinforcementTotal", "formworkArea", "excavationVolume", "wallArea"],
  validationRules: ["quantityPositive", "unitRequired", "codeUnique", "marginWithinRange"],
  documentLabels: { boq: "Construction BOQ", revision: "Revision", total: "Total Contract Value" },
  dashboardMetrics: [
    { label: "Structural BOQs", value: "12", status: "normal" },
    { label: "Approved Sections", value: "8", status: "success" },
  ],
};
