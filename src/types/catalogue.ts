export type CatalogueStatus = "active" | "expired" | "inactive";

export type CatalogueItem = {
  id: string;
  itemCode: string;
  industryId: string;
  category: string;
  description: string;
  unit: string;
  supplier: string;
  cost: number;
  defaultMargin: number;
  sellingRate: number;
  effectiveDate: string;
  expiryDate?: string;
  currency: string;
  status: CatalogueStatus;
};
