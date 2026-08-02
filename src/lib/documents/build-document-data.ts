import type { BOQ, BOQItem } from "@/types/boq";

export type DocumentAudienceValue = "INTERNAL" | "CLIENT";

export type DocumentCompanyData = {
  legalName: string;
  tradeName: string;
  logoUrl: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  taxRegistrationNumber: string | null;
  defaultCurrency: string;
};

export type DocumentClientData = {
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxRegistrationNumber: string | null;
};

export type DocumentProjectData = {
  name: string;
  reference: string;
  location: string;
  industry: string;
  currency: string;
  taxRate: number;
  language: string;
};

export type DocumentBOQItemData = {
  itemNumber: number;
  itemCode: string;
  description: string;
  specification: string;
  unit: string;
  quantity: number;
  sellingRate: number;
  totalAmount: number;
  roomOrZone: string;
  drawingReference: string;
  notes: string;
  unitCost?: number;
  freightCost?: number;
  installationCost?: number;
  additionalCost?: number;
  landedCost?: number;
  marginPercentage?: number;
  marginMode?: string;
};

export type DocumentBOQSectionData = {
  code: string;
  title: string;
  description: string;
  items: DocumentBOQItemData[];
};

export type DocumentBOQData = {
  title: string;
  revision: string;
  revisionNumber: number;
  status: BOQ["status"];
  lockedAt: string | null;
  sections: DocumentBOQSectionData[];
  totals: BOQ["totals"];
  termsText: string;
  exclusionsText: string;
  validityDays: number;
  notes: string;
  showInternalFields: boolean;
};

export type DocumentMeta = {
  generatedAt: string;
  generatedByName: string;
  templateName: string;
  documentType: string;
  audience: DocumentAudienceValue;
  isDraft: boolean;
};

export type CanonicalDocumentData = {
  company: DocumentCompanyData;
  client: DocumentClientData;
  project: DocumentProjectData;
  boq: DocumentBOQData;
  meta: DocumentMeta;
};

export const DEFAULT_TERMS_TEXT =
  "Payment terms: 30% advance upon order confirmation, 40% upon delivery of materials to site, 30% upon completion and handover. " +
  "All rates are exclusive of VAT unless stated otherwise. Prices are valid in the currency stated above.";

export const DEFAULT_EXCLUSIONS_TEXT =
  "Excludes: statutory authority approval fees, items not explicitly listed in this Bill of Quantities, and works arising from " +
  "site conditions not reasonably foreseeable at the time of this quotation.";

export const DEFAULT_VALIDITY_DAYS = 30;

export type BuildDocumentDataInput = {
  company: {
    legalName: string;
    tradeName: string;
    email: string;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    taxRegistrationNumber?: string | null;
    defaultCurrency: string;
    logoUrl?: string | null;
  };
  client: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxRegistrationNumber?: string | null;
  };
  project: {
    name: string;
    reference: string;
    location?: string | null;
    currency: string;
    taxRate: number;
    language: string;
  };
  industryName: string;
  boq: BOQ;
  revisionNumber: number;
  audience: DocumentAudienceValue;
  templateName: string;
  documentType: string;
  generatedByName: string;
  isDraft: boolean;
  showInternalCostFieldsToClient?: boolean;
  termsText?: string;
  exclusionsText?: string;
  validityDays?: number;
  notes?: string;
  generatedAt?: Date;
};

function toItemData(item: BOQItem, showInternalFields: boolean): DocumentBOQItemData {
  const base: DocumentBOQItemData = {
    itemNumber: item.itemNumber,
    itemCode: item.itemCode,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    quantity: item.quantity,
    sellingRate: item.sellingRate,
    totalAmount: item.totalAmount,
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    notes: item.notes,
  };
  if (!showInternalFields) return base;
  return {
    ...base,
    unitCost: item.unitCost,
    freightCost: item.freightCost,
    installationCost: item.installationCost,
    additionalCost: item.additionalCost,
    landedCost: item.landedCost,
    marginPercentage: item.marginPercentage,
    marginMode: item.marginMode,
  };
}

/**
 * The one canonical document object every generator (CSV/XLSX/PDF/DOCX/HTML)
 * consumes. Internal commercial fields (unitCost/landedCost/margin/etc.) are
 * only present on items when `showInternalFields` resolves true — CLIENT
 * audience documents never see them unless the template explicitly opts in
 * via `showInternalCostFieldsToClient`. Generators must never reach past
 * this object back into the BOQ DTO or Prisma rows for commercial data.
 */
export function buildDocumentData(input: BuildDocumentDataInput): CanonicalDocumentData {
  const showInternalFields = input.audience === "INTERNAL" || Boolean(input.showInternalCostFieldsToClient);

  return {
    company: {
      legalName: input.company.legalName,
      tradeName: input.company.tradeName,
      logoUrl: input.company.logoUrl ?? null,
      address: input.company.address ?? null,
      email: input.company.email,
      phone: input.company.phone ?? null,
      website: input.company.website ?? null,
      taxRegistrationNumber: input.company.taxRegistrationNumber ?? null,
      defaultCurrency: input.company.defaultCurrency,
    },
    client: {
      name: input.client.name,
      companyName: input.client.companyName ?? null,
      email: input.client.email ?? null,
      phone: input.client.phone ?? null,
      address: input.client.address ?? null,
      taxRegistrationNumber: input.client.taxRegistrationNumber ?? null,
    },
    project: {
      name: input.project.name,
      reference: input.project.reference,
      location: input.project.location ?? "",
      industry: input.industryName,
      currency: input.project.currency,
      taxRate: input.project.taxRate,
      language: input.project.language,
    },
    boq: {
      title: input.boq.title,
      revision: input.boq.revision,
      revisionNumber: input.revisionNumber,
      status: input.boq.status,
      lockedAt: input.boq.lockedAt ?? null,
      sections: input.boq.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          code: section.code,
          title: section.title,
          description: section.description,
          items: section.items.map((item) => toItemData(item, showInternalFields)),
        })),
      totals: input.boq.totals,
      termsText: input.termsText ?? DEFAULT_TERMS_TEXT,
      exclusionsText: input.exclusionsText ?? DEFAULT_EXCLUSIONS_TEXT,
      validityDays: input.validityDays ?? DEFAULT_VALIDITY_DAYS,
      notes: input.notes ?? "",
      showInternalFields,
    },
    meta: {
      generatedAt: (input.generatedAt ?? new Date()).toISOString(),
      generatedByName: input.generatedByName,
      templateName: input.templateName,
      documentType: input.documentType,
      audience: input.audience,
      isDraft: input.isDraft,
    },
  };
}
