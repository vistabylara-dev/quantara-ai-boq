export type PublicCapabilityStatus =
  | "AVAILABLE"
  | "CONTROLLED_ACCESS"
  | "LIMITED"
  | "NOT_AVAILABLE";

export type PublicCapability = {
  id: string;
  name: string;
  status: PublicCapabilityStatus;
  summary: string;
  limitation?: string;
};

export const PUBLIC_CAPABILITY_STATUS_LABELS: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "Available",
  CONTROLLED_ACCESS: "Controlled access",
  LIMITED: "Limited",
  NOT_AVAILABLE: "Not available",
};

export const PUBLIC_CAPABILITY_STATUS_DESCRIPTIONS: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "Available in the current supported product workflow.",
  CONTROLLED_ACCESS: "Available only when the relevant account, configuration or entitlement is enabled.",
  LIMITED: "Available within the limitation stated for this capability.",
  NOT_AVAILABLE: "Not represented as a current Quantara capability.",
};

export const QUANTARA_ENTITY_DEFINITION =
  "Quantara is AI-assisted BOQ workflow software for construction professionals.";

export const QUANTARA_WORKFLOW_TRUTH =
  "Quantara helps construction professionals move from supported project sources through reviewed extraction, dimensions, visible calculations, BOQ organization, review and validation to professional outputs. Quantara assists the professional; it does not replace professional judgement.";

export const PROFESSIONAL_REVIEW_NOTICE =
  "Project information, extracted data, measurements, calculations, rates and outputs require review by the responsible construction professional before tender, procurement, contractual or construction use.";

const PUBLIC_CAPABILITY_DEFINITIONS = [
  {
    id: "project-workspaces",
    name: "Project source workspaces",
    status: "AVAILABLE",
    summary: "Keep supported project files and BOQ records within a project workspace.",
  },
  {
    id: "text-pdf-extraction",
    name: "Text-based PDF extraction",
    status: "AVAILABLE",
    summary: "Capture supported text and table information from text-based PDF files for professional review.",
    limitation: "Results depend on the source layout and must be checked against the original file.",
  },
  {
    id: "spreadsheet-import",
    name: "XLSX and CSV import",
    status: "AVAILABLE",
    summary: "Bring supported structured spreadsheet data into a reviewable project workflow.",
    limitation: "Column mapping and imported values still require review.",
  },
  {
    id: "scanned-pdf-detection",
    name: "Scanned PDF detection",
    status: "LIMITED",
    summary: "Detect image-only PDF pages and identify that text extraction is unavailable.",
    limitation: "Quantara does not currently perform OCR text extraction from scanned or image-only PDFs.",
  },
  {
    id: "google-drive-import",
    name: "Google Drive project-file import",
    status: "CONTROLLED_ACCESS",
    summary: "Import selected supported files from an authorized Google Drive connection into a Quantara project.",
    limitation: "Availability depends on an authorized workspace connection and supported file types.",
  },
  {
    id: "reviewed-extraction",
    name: "Reviewed extracted information",
    status: "AVAILABLE",
    summary: "Confirm, correct or reject supported extracted information before using it in later BOQ work.",
  },
  {
    id: "boq-management",
    name: "Structured BOQ management",
    status: "AVAILABLE",
    summary: "Organize BOQ sections, items, quantities, units and revisions within a project.",
  },
  {
    id: "visible-calculations",
    name: "Dimensions and visible quantity calculations",
    status: "LIMITED",
    summary: "For supported deterministic measurement types, review required dimensions, the visible equation and the proposed result before confirmation.",
    limitation: "Quantara does not automatically measure drawings, and not every BOQ item has a supported calculation type.",
  },
  {
    id: "voice-proposals",
    name: "Voice-assisted change proposals",
    status: "CONTROLLED_ACCESS",
    summary: "Use voice in supported BOQ contexts to propose a measurement or item-field change for review.",
    limitation: "A transcript is interpreted as a proposal; the user must confirm before governed project data changes.",
  },
  {
    id: "validation",
    name: "BOQ validation review",
    status: "AVAILABLE",
    summary: "Review supported validation findings before relying on a BOQ output.",
  },
  {
    id: "professional-outputs",
    name: "Professional project outputs",
    status: "AVAILABLE",
    summary: "Generate supported BOQ documents and project outputs from reviewed project data.",
    limitation: "Generated documents are not professional approval and remain subject to project-specific review.",
  },
  {
    id: "technical-report-generation",
    name: "Technical report generation",
    status: "AVAILABLE",
    summary: "Generate supported technical-report documents from reviewed project records and templates.",
    limitation: "Voice and typed AI editing of technical reports is not currently a supported public capability.",
  },
  {
    id: "source-attribution",
    name: "Source attribution",
    status: "LIMITED",
    summary: "Keep source identity and available evidence references with supported project records.",
    limitation: "Quantara does not claim complete end-to-end traceability for every BOQ field and generated output.",
  },
  {
    id: "industry-packages",
    name: "Catalogue and industry packages",
    status: "CONTROLLED_ACCESS",
    summary: "Use governed catalogue or industry-package data where the company has the required entitlement.",
    limitation: "Package availability and access vary; the public website does not represent every package as included.",
  },
  {
    id: "commercial-access",
    name: "Commercial plans and billing",
    status: "CONTROLLED_ACCESS",
    summary: "Commercial access is confirmed through a requirements discussion during Controlled Early Access.",
    limitation: "The public website does not offer verified self-serve plan checkout or automatic paid conversion.",
  },
  {
    id: "automatic-drawing-takeoff",
    name: "Automatic drawing measurement and takeoff",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not currently derive final dimensions or quantities automatically from drawing geometry.",
  },
  {
    id: "scanned-pdf-ocr",
    name: "OCR for scanned and image-only PDFs",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not currently extract text from scanned or image-only PDF pages using OCR.",
  },
  {
    id: "typed-multi-change-proposals",
    name: "Typed multi-change and selective approval",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not currently advertise a public typed, multi-operation proposal workflow with selective approval.",
  },
  {
    id: "single-sign-on",
    name: "Single sign-on (SSO)",
    status: "NOT_AVAILABLE",
    summary: "SSO is not a verified public Quantara capability.",
  },
] as const satisfies readonly PublicCapability[];

export type PublicCapabilityId = (typeof PUBLIC_CAPABILITY_DEFINITIONS)[number]["id"];

export const PUBLIC_CAPABILITIES: readonly PublicCapability[] = PUBLIC_CAPABILITY_DEFINITIONS;

export function getPublicCapability(id: PublicCapabilityId): PublicCapability {
  const capability = PUBLIC_CAPABILITIES.find((entry) => entry.id === id);
  if (!capability) {
    throw new Error(`Unknown public capability: ${id}`);
  }
  return capability;
}
