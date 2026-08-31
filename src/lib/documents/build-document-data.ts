import type { BOQ, BOQItem } from "@/types/boq";
import {
  FURNITURE_CANONICAL_OUTPUT_VERSION,
  FURNITURE_CANONICAL_SECTIONS,
  type FurnitureCanonicalSectionCode,
} from "@/lib/furniture/canonical-output";
import { JOINERY_INDUSTRY_KEY, readStrictFurnitureManagedKey } from "@/lib/furniture/types";

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

export type DocumentPricingMode = "WITH_PRICES" | "QUANTITIES_ONLY";

export type DocumentBOQItemData = {
  itemNumber: number;
  itemCode: string;
  description: string;
  specification: string;
  unit: string;
  quantity: number;
  /** Absent entirely (not zeroed) in QUANTITIES_ONLY mode — see buildDocumentData. */
  sellingRate?: number;
  totalAmount?: number;
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
  /** Absent entirely in QUANTITIES_ONLY mode — see buildDocumentData. */
  totals?: BOQ["totals"];
  termsText: string;
  exclusionsText: string;
  validityDays: number;
  notes: string;
  showInternalFields: boolean;
  pricingMode: DocumentPricingMode;
};

export type DocumentFurnitureItemData = DocumentBOQItemData & {
  category: string;
  wastagePercentage: number;
  sourceReference: string;
  confidenceScore: number;
};

export type DocumentFurnitureSectionData = Omit<DocumentBOQSectionData, "code" | "items"> & {
  code: FurnitureCanonicalSectionCode;
  items: DocumentFurnitureItemData[];
};

/**
 * Exact-industry-only payload consumed by every specialized Joinery document renderer.
 * It is normalized once from the managed BOQ, so PDF, DOCX, XLSX and HTML
 * cannot independently rename, omit, or reorder the five output sections.
 */
export type DocumentFurnitureData = {
  outputVersion: typeof FURNITURE_CANONICAL_OUTPUT_VERSION;
  sections: DocumentFurnitureSectionData[];
};

export type DocumentMeta = {
  generatedAt: string;
  generatedByName: string;
  templateName: string;
  documentType: string;
  audience: DocumentAudienceValue;
  isDraft: boolean;
  /** Set only for documents generated under a trial subscription — never removable via template settings (spec Phase 7 section 13). */
  watermarkText: string | null;
};

export type CanonicalDocumentData = {
  company: DocumentCompanyData;
  client: DocumentClientData;
  project: DocumentProjectData;
  boq: DocumentBOQData;
  furniture?: DocumentFurnitureData;
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
  industryKey?: string | null;
  boq: BOQ;
  revisionNumber: number;
  audience: DocumentAudienceValue;
  templateName: string;
  documentType: string;
  generatedByName: string;
  isDraft: boolean;
  showInternalCostFieldsToClient?: boolean;
  /** TAYQAN Draft BOQ Word export. Defaults to today's existing (priced) behavior. */
  pricingMode?: DocumentPricingMode;
  termsText?: string;
  exclusionsText?: string;
  validityDays?: number;
  notes?: string;
  generatedAt?: Date;
  watermarkText?: string | null;
};

function toItemData(item: BOQItem, showInternalFields: boolean, pricingMode: DocumentPricingMode): DocumentBOQItemData {
  const base: DocumentBOQItemData = {
    itemNumber: item.itemNumber,
    itemCode: item.itemCode,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    quantity: item.quantity,
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    notes: item.notes,
    ...(pricingMode === "WITH_PRICES" ? { sellingRate: item.sellingRate, totalAmount: item.totalAmount } : {}),
  };
  if (!showInternalFields || pricingMode === "QUANTITIES_ONLY") return base;
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

function toFurnitureItemData(
  item: BOQItem,
  showInternalFields: boolean,
  pricingMode: DocumentPricingMode,
): DocumentFurnitureItemData {
  return {
    ...toItemData(item, showInternalFields, pricingMode),
    category: item.category,
    wastagePercentage: item.wastagePercentage,
    sourceReference: item.sourceReference,
    confidenceScore: item.confidenceScore,
  };
}

function buildFurnitureDocumentData(
  industryKey: string | null | undefined,
  sections: readonly BOQ["sections"][number][],
  showInternalFields: boolean,
  pricingMode: DocumentPricingMode,
): DocumentFurnitureData | null {
  if (industryKey !== JOINERY_INDUSTRY_KEY) return null;

  // Existing Joinery BOQs predate the specialized five-section output and
  // must remain downloadable, including when locked. Only BOQs that have
  // entered the canonical Joinery layout are normalized by this adapter;
  // legacy section sets continue through the unchanged generic renderer.
  const hasStrictManagedRow = sections.some((section) => section.items.some((item) =>
    readStrictFurnitureManagedKey({
      itemCode: item.itemCode,
      sourceReference: item.sourceReference,
      notes: item.notes,
    }) !== null));
  if (!hasStrictManagedRow) return null;

  const sectionsByCode = new Map<string, BOQ["sections"][number]>();
  for (const section of sections) {
    if (sectionsByCode.has(section.code)) {
      throw new Error(`Furniture document output contains duplicate section code ${section.code}.`);
    }
    sectionsByCode.set(section.code, section);
  }
  const canonicalCodes = new Set<string>(FURNITURE_CANONICAL_SECTIONS.map((definition) => definition.code));
  const preservedLegacyItems = sections
    .filter((section) => !canonicalCodes.has(section.code))
    .flatMap((section) => section.items);

  return {
    outputVersion: FURNITURE_CANONICAL_OUTPUT_VERSION,
    sections: FURNITURE_CANONICAL_SECTIONS.map((definition) => {
      const persisted = sectionsByCode.get(definition.code);
      if (!persisted) {
        throw new Error(`Furniture document output is missing canonical section ${definition.code}.`);
      }
      return {
        code: definition.code,
        title: definition.title,
        description: definition.description,
        items: [
          ...persisted.items,
          ...(definition.code === "VER" ? preservedLegacyItems : []),
        ].map((item) => toFurnitureItemData(item, showInternalFields, pricingMode)),
      };
    }),
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
  const pricingMode: DocumentPricingMode = input.pricingMode ?? "WITH_PRICES";
  const quantitiesOnly = pricingMode === "QUANTITIES_ONLY";
  const furniture = buildFurnitureDocumentData(
    input.industryKey,
    input.boq.sections,
    showInternalFields,
    pricingMode,
  );
  const sections: DocumentBOQSectionData[] = input.boq.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      code: section.code,
      title: section.title,
      description: section.description,
      items: section.items.map((item) => toItemData(item, showInternalFields, pricingMode)),
    }));

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
      sections,
      ...(quantitiesOnly ? {} : { totals: input.boq.totals }),
      // No VAT/payment terms apply before a BOQ has been priced — the
      // pricing disclaimer is never included in quantities-only mode, not
      // even reworded. The generator shows its own "for scope review" note.
      termsText: quantitiesOnly ? "" : (input.termsText ?? DEFAULT_TERMS_TEXT),
      exclusionsText: input.exclusionsText ?? DEFAULT_EXCLUSIONS_TEXT,
      validityDays: input.validityDays ?? DEFAULT_VALIDITY_DAYS,
      notes: input.notes ?? "",
      showInternalFields: showInternalFields && !quantitiesOnly,
      pricingMode,
    },
    ...(furniture ? { furniture } : {}),
    meta: {
      generatedAt: (input.generatedAt ?? new Date()).toISOString(),
      generatedByName: input.generatedByName,
      templateName: input.templateName,
      documentType: input.documentType,
      audience: input.audience,
      isDraft: input.isDraft,
      watermarkText: input.watermarkText ?? null,
    },
  };
}
