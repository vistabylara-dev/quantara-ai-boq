import type { IndustryEngine } from "@/types/industry";

export const interiorFitoutEngine: IndustryEngine = {
  id: "interior-fitout",
  name: "Interior Fit-Out",
  shortName: "Fit-Out",
  description: "Interior finishing, joinery, and fit-out deliverables for corporate spaces.",
  icon: "layers",
  status: "active",
  supportedUnits: ["m2", "lm", "nos", "sets", "LS"],
  boqSections: [
    { id: "demolition", code: "DEM", title: "Demolition", description: "Removal and preparation works.", order: 1 },
    { id: "partitions", code: "PRT", title: "Partitions", description: "Interior partition systems.", order: 2 },
    { id: "ceilings", code: "CLG", title: "Ceilings", description: "Suspended ceiling systems.", order: 3 },
    { id: "flooring", code: "FLR", title: "Flooring", description: "Floor finishes and coverings.", order: 4 },
    { id: "wall-finishes", code: "WLF", title: "Wall Finishes", description: "Wall finishes and decorations.", order: 5 },
  ],
  requiredFields: ["room", "finishCode", "material", "colour", "brand", "ceilingHeight", "wallHeight", "perimeter", "floorArea", "wastage"],
  calculationTypes: ["flooringArea", "ceilingArea", "skirtingLength", "wallFinishArea"],
  validationRules: ["quantityPositive", "unitRequired", "descriptionRequired", "specificationRequired"],
  documentLabels: { boq: "Interior Fit-Out BOQ", projectSummary: "Interior Fit-Out Scope" },
  dashboardMetrics: [
    { label: "Fit-Out Projects", value: "6", status: "normal" },
    { label: "Client Approvals", value: "4", status: "warning" },
  ],
};
