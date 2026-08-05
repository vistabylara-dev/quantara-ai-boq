export type FeatureStatus = "live" | "preview" | "development" | "planned";

export interface PublicFeature {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  status: FeatureStatus;
}

export const publicFeatures: PublicFeature[] = [
  {
    slug: "multi-source",
    name: "Hybrid-Source Projects",
    shortDescription: "Combine supported PDFs, XLSX and CSV imports within one project workspace.",
    longDescription: "Create a project workspace to manage manual uploads and structured imports in one controlled location.",
    status: "live"
  },
  {
    slug: "ai-extraction",
    name: "AI-Assisted Document Extraction",
    shortDescription: "Extract relevant scope, item, quantity, and specification information from supported project documents.",
    longDescription: "Extract relevant scope, item, quantity, and specification information for structured human review.",
    status: "live"
  },
  {
    slug: "source-normalization",
    name: "Source Normalization",
    shortDescription: "Organize supported extracted or imported fields into a consistent, reviewable project structure.",
    longDescription: "Organize supported extracted or imported fields into a consistent, reviewable project structure.",
    status: "live"
  },
  {
    slug: "structured-management",
    name: "Structured BOQ Management",
    shortDescription: "Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.",
    longDescription: "Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.",
    status: "live"
  },
  {
    slug: "governed-ai",
    name: "Governed AI Change Proposals",
    shortDescription: "Give Quantara spoken or typed instructions, review structured AI proposals and selectively approve changes.",
    longDescription: "Give Quantara spoken or typed instructions, review structured AI proposals and selectively approve changes.",
    status: "development"
  },
  {
    slug: "revision-history",
    name: "BOQ Revision History",
    shortDescription: "Track changes with ordinary BOQ revisions.",
    longDescription: "Track changes with ordinary BOQ revisions.",
    status: "live"
  },
  {
    slug: "ai-proposal-revisions",
    name: "AI Proposal-Linked Governed Revisions",
    shortDescription: "Automatically create a governed revision from approved AI changes.",
    longDescription: "Automatically create a governed revision from approved AI changes.",
    status: "development"
  },
  {
    slug: "full-traceability",
    name: "Full Source-Linked Traceability",
    shortDescription: "Maintain complete traceability from generated BOQ back to the exact source document.",
    longDescription: "Maintain complete traceability from generated BOQ back to the exact source document.",
    status: "development"
  },
  {
    slug: "document-generation",
    name: "Professional Document Generation",
    shortDescription: "Generate professional outputs including PDF and XLSX formats from verified project data.",
    longDescription: "Generate professional outputs including PDF and XLSX formats from verified project data.",
    status: "live"
  },
  {
    slug: "project-source-centre",
    name: "Project Source Centre",
    shortDescription: "Centralized management of normalized source documents and source versions.",
    longDescription: "Centralized management of normalized source documents and source versions.",
    status: "development"
  },
  {
    slug: "connected-applications",
    name: "Connected Project Sources",
    shortDescription: "Connect verified external applications into the appropriate project when integrations are available.",
    longDescription: "Connect verified external applications into the appropriate project when integrations are available.",
    status: "planned"
  }
];