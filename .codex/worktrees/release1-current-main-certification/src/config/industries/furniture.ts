import type { IndustryEngine } from "@/types/industry";

export const furnitureEngine: IndustryEngine = {
  id: "furniture",
  name: "Furniture",
  shortName: "Furniture",
  description: "Furniture BOQ engine with product options, finishes, and installation.",
  icon: "chair",
  status: "active",
  supportedUnits: ["pcs", "sets", "units", "LS"],
  boqSections: [
    { id: "executive-furniture", code: "EXE", title: "Executive Furniture", description: "Office executive furniture items.", order: 1 },
    { id: "workstations", code: "WRK", title: "Workstations", description: "Modular workstation systems.", order: 2 },
    { id: "seating", code: "SEA", title: "Seating", description: "Chairs and lounge seating.", order: 3 },
    { id: "storage", code: "STO", title: "Storage", description: "Cabinets and storage furniture.", order: 4 },
  ],
  requiredFields: ["sku", "brand", "model", "dimensions", "finish", "colour", "upholstery", "warranty", "leadTime", "room", "assemblyRequired"],
  calculationTypes: ["unitCount", "setQuantity", "optionSelection"],
  validationRules: ["quantityPositive", "specificationRequired", "optionSelectionValid"],
  documentLabels: { boq: "Furniture BOQ", itemsList: "Furniture Package" },
  dashboardMetrics: [
    { label: "Furniture Lines", value: "28", status: "normal" },
    { label: "Option Sets", value: "9", status: "success" },
  ],
};
