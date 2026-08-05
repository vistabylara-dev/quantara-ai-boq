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
    slug: "document-extraction",
    name: "AI-Assisted Document Extraction",
    shortDescription: "Extract relevant scope, item, quantity, and specification information from supported project documents for structured human review.",
    longDescription: "Extract relevant scope, item, quantity, and specification information from supported project documents for structured human review.",
    status: "live"
  },
  {
    slug: "boq-management",
    name: "Structured BOQ Management",
    shortDescription: "Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.",
    longDescription: "Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.",
    status: "live"
  },
  {
    slug: "item-grouping",
    name: "Automated Item Grouping",
    shortDescription: "Group extracted or entered BOQ content into controlled categories and sections while preserving review and editing.",
    longDescription: "Group extracted or entered BOQ content into controlled categories and sections while preserving review and editing.",
    status: "preview"
  },
  {
    slug: "workspaces",
    name: "Project and Client Workspaces",
    shortDescription: "Manage BOQs, projects, clients, revisions and generated records within authenticated company workspaces.",
    longDescription: "Manage BOQs, projects, clients, revisions and generated records within authenticated company workspaces.",
    status: "live"
  },
  {
    slug: "templates",
    name: "Governed Templates and Documents",
    shortDescription: "Use approved templates to create consistent proposals, BOQ documents, and technical project outputs.",
    longDescription: "Use approved templates to create consistent proposals, BOQ documents, and technical project outputs.",
    status: "live"
  },
  {
    slug: "pricing-intelligence",
    name: "Pricing and Supplier Intelligence",
    shortDescription: "Build controlled pricing information and supplier-related workflows to support future estimating intelligence.",
    longDescription: "Build controlled pricing information and supplier-related workflows to support future estimating intelligence.",
    status: "development"
  },
  {
    slug: "google-drive",
    name: "Google Drive integration",
    shortDescription: "Document import and export support for Google Drive is in development. Availability remains subject to implementation, authorization and testing.",
    longDescription: "Document import and export support for Google Drive is in development. Availability remains subject to implementation, authorization and testing.",
    status: "development"
  },
  {
    slug: "cad-bim",
    name: "CAD/BIM/IFC support",
    shortDescription: "Planned support for additional model-based and design-file workflows. Final supported formats and capabilities will be confirmed after technical validation.",
    longDescription: "Planned support for additional model-based and design-file workflows. Final supported formats and capabilities will be confirmed after technical validation.",
    status: "planned"
  },
  {
    slug: "estimating-analytics",
    name: "Advanced Estimating Analytics",
    shortDescription: "Planned estimating analytics intended to support review of historical BOQ and pricing information. Final functionality has not yet been confirmed.",
    longDescription: "Planned estimating analytics intended to support review of historical BOQ and pricing information. Final functionality has not yet been confirmed.",
    status: "planned"
  }
];
