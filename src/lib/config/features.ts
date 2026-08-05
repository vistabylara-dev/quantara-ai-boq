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
    name: "Multi-Source Project Workspace",
    shortDescription: "Bring project data into one workspace via manual uploads, structured imports, or connected applications.",
    longDescription: "Create a project workspace to manage hybrid sources in one controlled location.",
    status: "live"
  },
  {
    slug: "ai-extraction",
    name: "AI-Assisted Document and Data Extraction",
    shortDescription: "Extract relevant scope, item, quantity, and specification information from supported project documents.",
    longDescription: "Extract relevant scope, item, quantity, and specification information for structured human review.",
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
    slug: "traceability",
    name: "Revision and Source Traceability",
    shortDescription: "Track changes with governed revision creation and maintain source-linked BOQ traceability.",
    longDescription: "Track changes with governed revision creation and maintain source-linked BOQ traceability.",
    status: "live"
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
    status: "live"
  },
  {
    slug: "connected-applications",
    name: "Connected Project Sources",
    shortDescription: "Connect verified external applications into the appropriate project when integrations are available.",
    longDescription: "Connect verified external applications into the appropriate project when integrations are available.",
    status: "planned"
  }
];