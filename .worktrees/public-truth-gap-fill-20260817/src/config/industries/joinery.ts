import type { IndustryEngine } from "@/types/industry";

export const joineryEngine: IndustryEngine = {
  id: "joinery",
  name: "Joinery",
  shortName: "Joinery",
  description: "Joinery BOQ engine for custom furniture and architectural woodwork.",
  icon: "tool",
  status: "active",
  supportedUnits: ["m", "lm", "m2", "pcs", "sets", "LS"],
  boqSections: [
    { id: "kitchen", code: "KTN", title: "Kitchen", description: "Kitchen joinery and fixtures.", order: 1 },
    { id: "wardrobes", code: "WRD", title: "Wardrobes", description: "Built-in wardrobe systems.", order: 2 },
    { id: "reception", code: "RCP", title: "Reception Counters", description: "Reception and desk joinery.", order: 3 },
    { id: "wall-panels", code: "WPL", title: "Wall Panels", description: "Decorative wall paneling.", order: 4 },
  ],
  requiredFields: ["width", "height", "depth", "carcassMaterial", "finishMaterial", "edgeBand", "hardwareBrand", "numberOfDoors", "numberOfDrawers", "surfaceArea", "linearLength"],
  calculationTypes: ["surfaceArea", "linearMetre", "panelQuantity"],
  validationRules: ["quantityPositive", "specificationRequired", "dimensionComplete"],
  documentLabels: { boq: "Joinery BOQ", specifications: "Material Specifications" },
  dashboardMetrics: [
    { label: "Joinery Packages", value: "8", status: "normal" },
    { label: "Delivered Packages", value: "3", status: "success" },
  ],
};
