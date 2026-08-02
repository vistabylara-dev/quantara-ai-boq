import type { DocumentTemplate } from "@/types/document";

export const documentTemplates: DocumentTemplate[] = [
  {
    id: "corporate-technical",
    name: "Corporate Technical",
    description: "Clean technical BOQ output for construction and engineering proposals.",
    previewLabel: "Technical Proposal",
    type: "corporate",
  },
  {
    id: "executive-premium",
    name: "Executive Premium",
    description: "Executive proposal format with summary highlights and business terms.",
    previewLabel: "Executive Summary",
    type: "executive",
  },
  {
    id: "furniture-catalogue",
    name: "Furniture Catalogue",
    description: "Product-focused furniture BOQ and option comparison template.",
    previewLabel: "Furniture Catalogue",
    type: "furniture",
  },
  {
    id: "mep-tender",
    name: "MEP Tender",
    description: "Engineering tender template for mechanical, electrical and plumbing packages.",
    previewLabel: "MEP Tender",
    type: "mep",
  },
  {
    id: "arabic-formal",
    name: "Arabic Formal",
    description: "Formal client-facing template with bilingual labeling for regional proposals.",
    previewLabel: "Client Preview",
    type: "arabic",
  },
];
