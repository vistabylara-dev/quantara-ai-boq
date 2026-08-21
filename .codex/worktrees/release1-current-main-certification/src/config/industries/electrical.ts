import type { IndustryEngine } from "@/types/industry";

export const electricalEngine: IndustryEngine = {
  id: "electrical",
  name: "Electrical",
  shortName: "Electrical",
  description: "Electrical BOQ engine focused on power distribution, lighting, and cabling.",
  icon: "plug",
  status: "active",
  supportedUnits: ["nos", "m", "lm", "m2", "sets", "points", "kW", "LS"],
  boqSections: [
    { id: "distribution", code: "DIS", title: "Main Distribution", description: "Power distribution systems.", order: 1 },
    { id: "panels", code: "PNL", title: "Panels", description: "Distribution and control panels.", order: 2 },
    { id: "cabling", code: "CBL", title: "Cabling", description: "Power and control cabling.", order: 3 },
    { id: "lighting", code: "LGT", title: "Lighting", description: "Lighting fixtures and accessories.", order: 4 },
    { id: "earthing", code: "EAR", title: "Earthing", description: "Earthing and bonding systems.", order: 5 },
  ],
  requiredFields: ["cableType", "cableSize", "numberOfCores", "panelReference", "circuitReference", "load", "voltage", "phase", "containmentType", "lightingType"],
  calculationTypes: ["cableLength", "loadEstimate", "circuitCount"],
  validationRules: ["quantityPositive", "unitRequired", "descriptionRequired"],
  documentLabels: { boq: "Electrical BOQ", specification: "Electrical Specifications" },
  dashboardMetrics: [
    { label: "Electrical Lines", value: "18", status: "normal" },
    { label: "Pending Testing", value: "12", status: "warning" },
  ],
};
