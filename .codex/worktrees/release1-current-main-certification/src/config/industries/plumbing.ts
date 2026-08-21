import type { IndustryEngine } from "@/types/industry";

export const plumbingEngine: IndustryEngine = {
  id: "plumbing",
  name: "Plumbing",
  shortName: "Plumbing",
  description: "Plumbing BOQ engine for water supply, drainage and fixtures.",
  icon: "droplet",
  status: "active",
  supportedUnits: ["m", "lm", "nos", "sets", "LS"],
  boqSections: [
    { id: "water-supply", code: "WAT", title: "Water Supply", description: "Cold and hot water distribution.", order: 1 },
    { id: "drainage", code: "DRN", title: "Drainage", description: "Sanitary and storm drainage works.", order: 2 },
    { id: "sanitary", code: "SAN", title: "Sanitary Fixtures", description: "Sanitary fixtures and accessories.", order: 3 },
    { id: "testing", code: "TST", title: "Testing", description: "Pressure testing and commissioning.", order: 4 },
  ],
  requiredFields: ["pipeMaterial", "pipeDiameter", "pressureRating", "fixtureType", "connectionType", "flowRate"],
  calculationTypes: ["pipeLength", "fixtureCount", "flowEstimate"],
  validationRules: ["quantityPositive", "unitRequired", "materialRequired"],
  documentLabels: { boq: "Plumbing BOQ", inspection: "Plumbing Inspection" },
  dashboardMetrics: [
    { label: "Plumbing Lines", value: "21", status: "normal" },
    { label: "Pressure Tests", value: "3", status: "warning" },
  ],
};
