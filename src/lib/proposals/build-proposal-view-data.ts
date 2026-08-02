import { Prisma } from "@prisma/client";
import type { BOQ } from "@/types/boq";
import { calculateBOQTotals, calculateTotalAmount } from "@/lib/calculations/boq-calculator";
import { DEFAULT_EXCLUSIONS_TEXT, DEFAULT_TERMS_TEXT } from "@/lib/documents/build-document-data";
import type { ClientProposalSettings } from "./proposal-settings";

export type ProposalViewOption = {
  id: string;
  label: string;
  description: string;
  specification: string;
  rate: number;
  isSelected: boolean;
};

export type ProposalViewItem = {
  id: string;
  itemNumber: number;
  itemCode: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  unitRate: number | null;
  totalAmount: number;
  roomOrZone: string;
  drawingReference: string;
  options: ProposalViewOption[];
};

export type ProposalViewSection = {
  code: string;
  title: string;
  description: string;
  items: ProposalViewItem[];
  sectionTotal: number | null;
};

export type ProposalViewTotals = {
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
};

export type ProposalViewData = {
  company: {
    legalName: string;
    tradeName: string;
    logoUrl: string | null;
    address: string | null;
    email: string;
    phone: string | null;
    website: string | null;
  };
  client: { name: string; companyName: string | null };
  project: { name: string; reference: string; location: string; currency: string; industry: string };
  boq: {
    title: string;
    revision: string;
    revisionNumber: number;
    sections: ProposalViewSection[];
    totals: ProposalViewTotals;
    termsText: string;
    exclusionsText: string;
  };
  settings: ClientProposalSettings;
};

export type BuildProposalViewDataInput = {
  company: {
    legalName: string;
    tradeName: string;
    address: string | null;
    email: string;
    phone: string | null;
    website: string | null;
  };
  client: { name: string; companyName: string | null };
  project: { name: string; reference: string; location: string; currency: string; taxRate: number; industryName: string };
  boq: BOQ;
  revisionNumber: number;
  settings: ClientProposalSettings;
  /** Map of boqItemId -> selected BOQItemOption id, from ClientProposal.selectedOptionsJson. */
  selectedOptions: Record<string, string>;
};

/**
 * Always client-safe: unlike the Phase 5 document builder, there is no
 * override flag here at all. Internal cost/landed-cost/margin fields are
 * never read, let alone included — the public portal has no path to see
 * them regardless of any future settings addition (see spec section 15:
 * "unless explicitly configured for a special internal portal, which is
 * outside this phase").
 */
export function buildProposalViewData(input: BuildProposalViewDataInput): ProposalViewData {
  const { settings } = input;

  const sections: ProposalViewSection[] = input.boq.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const items: ProposalViewItem[] = section.items.map((item) => {
        const selectedOptionId = input.selectedOptions[item.id];
        const selectedOption = selectedOptionId ? item.options.find((option) => option.id === selectedOptionId) : undefined;
        const effectiveRate = selectedOption ? selectedOption.rate : item.sellingRate;
        const totalAmount = calculateTotalAmount(item.quantity, effectiveRate).toNumber();
        return {
          id: item.id,
          itemNumber: item.itemNumber,
          itemCode: item.itemCode,
          description: item.description,
          specification: item.specification,
          quantity: item.quantity,
          unit: item.unit,
          unitRate: settings.showUnitRates ? effectiveRate : null,
          totalAmount,
          roomOrZone: item.roomOrZone,
          drawingReference: item.drawingReference,
          options: item.options.map((option) => ({
            id: option.id,
            label: option.label,
            description: option.description,
            specification: option.specification,
            rate: option.rate,
            isSelected: option.id === selectedOptionId,
          })),
        };
      });
      const sectionTotal = settings.showSectionTotals ? items.reduce((sum, item) => sum + item.totalAmount, 0) : null;
      return { code: section.code, title: section.title, description: section.description, items, sectionTotal };
    });

  const calculatorItems = sections.flatMap((section) =>
    section.items.map((item) => ({ totalAmount: item.totalAmount, quantity: item.quantity })),
  );
  const totals = calculateBOQTotals(calculatorItems, input.boq.totals.discountPercentage, input.project.taxRate);

  return {
    company: {
      legalName: input.company.legalName,
      tradeName: input.company.tradeName,
      logoUrl: null,
      address: input.company.address,
      email: input.company.email,
      phone: input.company.phone,
      website: input.company.website,
    },
    client: input.client,
    project: {
      name: input.project.name,
      reference: input.project.reference,
      location: input.project.location,
      currency: input.project.currency,
      industry: input.project.industryName,
    },
    boq: {
      title: input.boq.title,
      revision: input.boq.revision,
      revisionNumber: input.revisionNumber,
      sections,
      totals: {
        subtotal: totals.subtotal.toNumber(),
        discountPercentage: totals.discountPercentage.toNumber(),
        discountAmount: totals.discountAmount.toNumber(),
        taxableAmount: totals.taxableAmount.toNumber(),
        taxRate: totals.taxRate.toNumber(),
        taxAmount: totals.taxAmount.toNumber(),
        grandTotal: totals.grandTotal.toNumber(),
      },
      termsText: DEFAULT_TERMS_TEXT,
      exclusionsText: DEFAULT_EXCLUSIONS_TEXT,
    },
    settings,
  };
}

export type SelectedOptionsMap = Record<string, string>;

export function parseSelectedOptions(value: Prisma.JsonValue | null | undefined): SelectedOptionsMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: SelectedOptionsMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") result[key] = raw;
  }
  return result;
}
