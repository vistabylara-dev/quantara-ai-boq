import type { IndustryEngine } from "@/types/industry";

export const firefightingEngine: IndustryEngine = {
  id: "firefighting",
  name: "Fire Fighting",
  shortName: "Fire Fighting",
  description: "Fire protection BOQ engine for suppression and alarm systems.",
  icon: "shield-check",
  status: "active",
  supportedUnits: ["nos", "m", "lm", "sets", "LS"],
  boqSections: [
    { id: "fire-pump", code: "FPV", title: "Fire Pump System", description: "Fire pump and accessories.", order: 1 },
    { id: "sprinkler", code: "SPK", title: "Sprinkler System", description: "Sprinkler heads and piping.", order: 2 },
    { id: "hose-reel", code: "HRS", title: "Hose Reel System", description: "Hose reels and valves.", order: 3 },
    { id: "wet-riser", code: "WTR", title: "Wet Riser", description: "Wet riser and landing valves.", order: 4 },
  ],
  requiredFields: ["pipeDiameter", "sprinklerType", "hazardClassification", "pressureRating", "pumpCapacity", "equipmentTag"],
  calculationTypes: ["pipeLength", "headCount", "pumpSizing"],
  validationRules: ["quantityPositive", "unitRequired", "systemCompliance"],
  documentLabels: { boq: "Fire Fighting BOQ", compliance: "Fire Safety Compliance" },
  dashboardMetrics: [
    { label: "Fire Safety Items", value: "17", status: "normal" },
    { label: "Inspection Items", value: "2", status: "warning" },
  ],
};
