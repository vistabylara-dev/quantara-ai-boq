import type { IndustryEngine } from "@/types/industry";

export const landscapingEngine: IndustryEngine = {
  id: "landscaping",
  name: "Landscaping",
  shortName: "Landscaping",
  description: "Landscaping BOQ engine for softscape, hardscape and irrigation works.",
  icon: "tree-deciduous",
  status: "active",
  supportedUnits: ["m2", "m", "lm", "nos", "sets", "LS"],
  boqSections: [
    { id: "site-preparation", code: "SPR", title: "Site Preparation", description: "Ground preparation and site works.", order: 1 },
    { id: "soil", code: "SOL", title: "Soil", description: "Soil supply and treatment.", order: 2 },
    { id: "trees", code: "TRE", title: "Trees", description: "Tree planting and staking.", order: 3 },
    { id: "hardscape", code: "HSC", title: "Hardscape", description: "Paving, walls and structures.", order: 4 },
    { id: "irrigation", code: "IRR", title: "Irrigation", description: "Irrigation systems and fittings.", order: 5 },
  ],
  requiredFields: ["botanicalName", "commonName", "potSize", "plantHeight", "spacing", "irrigationZone", "coverageArea", "soilDepth"],
  calculationTypes: ["plantSpacing", "coverageArea", "irrigationLength"],
  validationRules: ["quantityPositive", "unitRequired", "plantSpecification"],
  documentLabels: { boq: "Landscaping BOQ", planting: "Planting Schedule" },
  dashboardMetrics: [
    { label: "Landscape Items", value: "14", status: "normal" },
    { label: "Maintenance Zones", value: "5", status: "success" },
  ],
};
