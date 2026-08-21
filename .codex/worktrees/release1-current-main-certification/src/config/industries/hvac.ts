import type { IndustryEngine } from "@/types/industry";

export const hvacEngine: IndustryEngine = {
  id: "hvac",
  name: "HVAC",
  shortName: "HVAC",
  description: "HVAC BOQ engine for heating, ventilation and air conditioning systems.",
  icon: "wind",
  status: "active",
  supportedUnits: ["nos", "m", "lm", "m2", "sets", "kW", "TR", "CFM", "LS"],
  boqSections: [
    { id: "equipment", code: "EQP", title: "HVAC Equipment", description: "Air handling and conditioning equipment.", order: 1 },
    { id: "ductwork", code: "DWT", title: "Ductwork", description: "Supply and return ducts.", order: 2 },
    { id: "diffusers", code: "DIF", title: "Diffusers & Grilles", description: "Air outlets and accessories.", order: 3 },
    { id: "piping", code: "PIP", title: "Refrigerant Piping", description: "Refrigerant and chilled water piping.", order: 4 },
    { id: "testing", code: "TST", title: "Testing & Balancing", description: "System commissioning and balancing.", order: 5 },
  ],
  requiredFields: ["equipmentTag", "capacityTR", "airflowCFM", "ductWidth", "ductHeight", "ductSurfaceArea", "pipeDiameter", "insulationThickness", "pressureClass"],
  calculationTypes: ["ductArea", "pipeLength", "capacityLoad"],
  validationRules: ["quantityPositive", "unitRequired", "pressureRatingRequired"],
  documentLabels: { boq: "HVAC BOQ", commissioning: "Commissioning Summary" },
  dashboardMetrics: [
    { label: "HVAC Systems", value: "9", status: "normal" },
    { label: "Balance Reports", value: "5", status: "success" },
  ],
};
