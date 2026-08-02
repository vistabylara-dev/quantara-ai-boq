import type { IndustryEngine } from "@/types/industry";

export const mepEngine: IndustryEngine = {
  id: "mep",
  name: "MEP",
  shortName: "MEP",
  description: "Mechanical, electrical, plumbing and fire fighting BOQ engine.",
  icon: "cpu",
  status: "active",
  supportedUnits: ["nos", "m", "lm", "m2", "sets", "points", "kW", "TR", "CFM", "LS"],
  boqSections: [
    { id: "mechanical", code: "MEC", title: "Mechanical", description: "Mechanical system works.", order: 1 },
    { id: "electrical", code: "ELE", title: "Electrical", description: "Electrical system works.", order: 2 },
    { id: "plumbing", code: "PLB", title: "Plumbing", description: "Plumbing system works.", order: 3 },
    { id: "fire-fighting", code: "FFS", title: "Fire Fighting", description: "Fire protection systems.", order: 4 },
    { id: "testing", code: "TST", title: "Testing & Commissioning", description: "System testing and handover.", order: 5 },
  ],
  requiredFields: ["discipline", "system", "equipmentTag", "pipeDiameter", "cableSize", "ductSize", "pressureRating", "flowRate", "powerRating", "capacity", "manufacturer", "drawingReference"],
  calculationTypes: ["pipeLength", "cableLength", "equipmentCount"],
  validationRules: ["quantityPositive", "disciplineRequired", "unitRequired"],
  documentLabels: { boq: "MEP BOQ", handover: "MEP Handover" },
  dashboardMetrics: [
    { label: "MEP Projects", value: "5", status: "normal" },
    { label: "System Items", value: "62", status: "warning" },
  ],
};
