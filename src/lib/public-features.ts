// ...existing code...
export type FeatureStatus = 'Live' | 'Preview UI' | 'In Development' | 'Planned';

export type PublicFeature = {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
};

export const PUBLIC_FEATURES: PublicFeature[] = [
  {
    id: 'ai-extraction',
    title: 'AI-Assisted Document Extraction',
    description:
      'Extraction of text and tabular BOQ data from supported document formats (PDF, scanned PDF, XLSX, CSV). Human review required.',
    status: 'Live',
  },
  {
    id: 'structured-boq',
    title: 'Structured BOQ Management',
    description:
      'Organise BOQ line items into structured project records, templates and exportable BOQ formats.',
    status: 'Preview UI',
  },
  {
    id: 'automated-grouping',
    title: 'Automated Item Grouping',
    description:
      'Assisted grouping of similar BOQ items to reduce manual sorting. Subject to review and refinement during Controlled Early Access.',
    status: 'Preview UI',
  },
  {
    id: 'workspaces',
    title: 'Project and Client Workspaces',
    description:
      'Authenticated company workspaces for project organisation and role-based access.',
    status: 'Preview UI',
  },
  {
    id: 'templates',
    title: 'Governed Templates and Documents',
    description:
      'Create and manage governed templates and document outputs with human approval workflows.',
    status: 'In Development',
  },
  {
    id: 'pricing-intel',
    title: 'Pricing and Supplier Intelligence',
    description:
      'Supplier and supply-chain workflows in development. Final supported data sources and functionality subject to implementation and testing.',
    status: 'Planned',
  },
  {
    id: 'google-drive',
    title: 'Google Drive integration',
    description:
      'Google Drive document import and export support is in development. Availability subject to authorization and testing.',
    status: 'In Development',
  },
  {
    id: 'cad-bim-ifc',
    title: 'CAD/BIM/IFC',
    description:
      'Planned support for additional model-based and design-file workflows. Supported formats and capabilities will be confirmed after validation.',
    status: 'Planned',
  },
  {
    id: 'advanced-analytics',
    title: 'Advanced Estimating Analytics',
    description:
      'Planned estimating analytics intended to support review of historical BOQ and pricing information. Final functionality not yet confirmed.',
    status: 'Planned',
  },
];