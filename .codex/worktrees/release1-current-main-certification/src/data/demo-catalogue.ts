import type { CatalogueItem } from "@/types/catalogue";

const NOW = new Date().toISOString();

function demoItem(base: {
  id: string;
  itemCode: string;
  industryId: string;
  category: string;
  description: string;
  unit: string;
  supplierName: string;
  baseCost: number;
  defaultMargin: number;
  sellingRate: number;
}): CatalogueItem {
  return {
    id: base.id,
    itemCode: base.itemCode,
    industryId: base.industryId,
    industryEngineId: base.industryId,
    category: base.category,
    subcategory: null,
    description: base.description,
    specification: null,
    unit: base.unit,
    supplierId: null,
    supplierName: base.supplierName,
    manufacturer: null,
    brand: null,
    model: null,
    countryOfOrigin: null,
    baseCost: base.baseCost,
    freightCost: 0,
    installationCost: 0,
    additionalCost: 0,
    landedCost: base.baseCost,
    marginMode: "MARKUP",
    defaultMargin: base.defaultMargin,
    sellingRate: base.sellingRate,
    minimumSellingRate: null,
    belowMinimum: false,
    currency: "AED",
    effectiveDate: NOW,
    expiryDate: null,
    status: "ACTIVE",
    sourceReference: null,
    supplierQuotationReference: null,
    metadataJson: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/**
 * Reference-only demo data for the still-local (non-database) modules. The
 * real /catalogue page is database-backed as of Phase 4 and does not read
 * from this file.
 */
export const demoCatalogue: CatalogueItem[] = [
  demoItem({
    id: "cat-001",
    itemCode: "C-001",
    industryId: "construction",
    category: "Concrete",
    description: "25 MPa ready-mix concrete",
    unit: "m3",
    supplierName: "Dubai Concrete",
    baseCost: 520,
    defaultMargin: 12,
    sellingRate: 582.4,
  }),
  demoItem({
    id: "cat-002",
    itemCode: "M-301",
    industryId: "mep",
    category: "Cabling",
    description: "4C x 16 mm2 power cable",
    unit: "m",
    supplierName: "PowerLine Supplies",
    baseCost: 33,
    defaultMargin: 10,
    sellingRate: 36.3,
  }),
  demoItem({
    id: "cat-003",
    itemCode: "I-101",
    industryId: "interior-fitout",
    category: "Flooring",
    description: "Commercial carpet tile supply and installation",
    unit: "m2",
    supplierName: "FloorTech UAE",
    baseCost: 95,
    defaultMargin: 12,
    sellingRate: 106.4,
  }),
  demoItem({
    id: "cat-004",
    itemCode: "F-201",
    industryId: "furniture",
    category: "Seating",
    description: "Ergonomic executive chair",
    unit: "pcs",
    supplierName: "OfficeComfort",
    baseCost: 1450,
    defaultMargin: 15,
    sellingRate: 1667.5,
  }),
];
