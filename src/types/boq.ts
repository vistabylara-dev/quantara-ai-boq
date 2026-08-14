export type BOQStatus = "draft" | "locked" | "approved";

export type BOQMarginMode = "markup" | "gross_margin" | "MARKUP" | "GROSS_MARGIN";

export type BOQItemOption = {
  id: string;
  label: string;
  description: string;
  rate: number;
  selected: boolean;
  specification: string;
};

export type BOQItemPricingMetadata = {
  catalogueItemId: string;
  catalogueItemCode: string;
  commercialSource: "catalogue";
  rateAppliedAt: string;
  rateAppliedByUserId: string;
  rateAppliedByName: string;
  supplierNameSnapshot: string | null;
  supplierQuotationReference: string | null;
  sourceExpiryDate: string | null;
  manuallyOverriddenFields: string[];
};

export type BOQItem = {
  id: string;
  itemNumber: number;
  itemCode: string;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  unitCost: number;
  freightCost?: number;
  installationCost?: number;
  additionalCost?: number;
  landedCost: number;
  marginMode?: BOQMarginMode;
  marginPercentage: number;
  sellingRate: number;
  totalAmount: number;
  wastagePercentage: number;
  taxApplicable: boolean;
  sourceReference: string;
  roomOrZone: string;
  drawingReference: string;
  confidenceScore: number;
  status: string;
  notes: string;
  options: BOQItemOption[];
  pricingMetadata?: BOQItemPricingMetadata | null;
  /** CANVA-MODEL-1 — true when this line's source is a premium MasterItem. Usable in the working draft regardless of entitlement; drives the commercial-requirements panel at export time. Optional so demo/sample/generator fixtures that predate this field don't need updating; treat as false when absent. */
  isPremiumSource?: boolean;
  integrity?: {
    quantity: { sourceType: string | null; confirmed: boolean };
    rate: { sourceType: string | null; confirmed: boolean };
  };
};

export type BOQSection = {
  id: string;
  code: string;
  title: string;
  description: string;
  order: number;
  items: BOQItem[];
  collapsed?: boolean;
};

export type BOQTotals = {
  directCost: number;
  landedCost: number;
  grossProfit: number;
  grossMarginPercentage: number;
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
};

export type BOQ = {
  id: string;
  projectId: string;
  title: string;
  revision: string;
  status: BOQStatus;
  sections: BOQSection[];
  totals: BOQTotals;
  taxRate?: number;
  isLocked?: boolean;
  createdAt: string;
  lockedAt?: string;
  lockedByUserId?: string;
  approvedBy?: string;
};
