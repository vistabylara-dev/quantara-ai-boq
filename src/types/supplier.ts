export type Supplier = {
  id: string;
  companyId: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  contactPerson: string | null;
  taxRegistrationNumber: string | null;
  defaultCurrency: string;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierWithCatalogueCount = Supplier & { catalogueItemCount: number };

export type SupplierListResult = {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
};
