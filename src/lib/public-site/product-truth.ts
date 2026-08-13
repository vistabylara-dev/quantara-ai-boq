import en from "@/lib/i18n/dictionaries/en";
import type { TranslateFn } from "@/lib/i18n/translate";

export type PublicCapabilityStatus =
  | "AVAILABLE"
  | "CONTROLLED_ACCESS"
  | "LIMITED"
  | "NOT_AVAILABLE";

export type PublicCapabilityLifecycle =
  | "LIVE"
  | "BETA_LIMITED"
  | "PLANNED"
  | "NOT_AVAILABLE";

export type PublicCapability = {
  id: string;
  name: string;
  status: PublicCapabilityStatus;
  lifecycle: PublicCapabilityLifecycle;
  summary: string;
  limitation?: string;
  evidencePaths: readonly string[];
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
    summary: "Store extractable text from text-based PDF files and create review candidates only from supported detected table rows.",
    limitation: "Plain paragraph text is not automatically converted into BOQ candidates; table results depend on the source layout and must be checked against the original file.",
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
    id: "document-templates",
    name: "Document templates",
    status: "AVAILABLE",
    summary: "Apply supported document templates to reviewed BOQ records and project data.",
    limitation: "Template configuration and every generated result still require project-specific review.",
  },
  {
    id: "technical-report-generation",
    name: "Technical report generation",
    status: "LIMITED",
    summary: "Generate DOCX technical reports from reviewed project records and templates in supported configured environments.",
    limitation: en.publicContent.productTruth.technicalReportLimitation,
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
    summary: en.publicContent.productTruth.commercialSummary,
    limitation: en.publicContent.productTruth.commercialLimitation,
  },
  {
    id: "automatic-drawing-takeoff",
    name: "Automatic drawing measurement and takeoff",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not currently derive final dimensions or quantities automatically from drawing geometry.",
  },
  {
    id: "model-file-import",
    name: "CAD, BIM and IFC model import",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not currently import CAD, BIM or IFC models for quantity extraction or BOQ creation.",
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
  {
    id: "non-google-external-integrations",
    name: en.publicContent.productTruth.nonGoogleIntegrationsName,
    status: "NOT_AVAILABLE",
    summary: en.publicContent.productTruth.nonGoogleIntegrationsSummary,
  },
  {
    id: "enterprise-feature-bundle",
    name: en.publicContent.productTruth.enterpriseBundleName,
    status: "NOT_AVAILABLE",
    summary: en.publicContent.productTruth.enterpriseBundleSummary,
  },
] as const satisfies readonly Omit<PublicCapability, "lifecycle" | "evidencePaths">[];

export type PublicCapabilityId = (typeof PUBLIC_CAPABILITY_DEFINITIONS)[number]["id"];

export const PUBLIC_PRODUCT_LIFECYCLE_BY_ID = {
  "project-workspaces": "LIVE",
  "text-pdf-extraction": "LIVE",
  "spreadsheet-import": "LIVE",
  "scanned-pdf-detection": "LIVE",
  "google-drive-import": "BETA_LIMITED",
  "reviewed-extraction": "LIVE",
  "boq-management": "LIVE",
  "visible-calculations": "LIVE",
  "voice-proposals": "BETA_LIMITED",
  validation: "LIVE",
  "professional-outputs": "LIVE",
  "document-templates": "LIVE",
  "technical-report-generation": "BETA_LIMITED",
  "source-attribution": "LIVE",
  "industry-packages": "BETA_LIMITED",
  "commercial-access": "BETA_LIMITED",
  "automatic-drawing-takeoff": "NOT_AVAILABLE",
  "model-file-import": "NOT_AVAILABLE",
  "scanned-pdf-ocr": "NOT_AVAILABLE",
  "typed-multi-change-proposals": "NOT_AVAILABLE",
  "single-sign-on": "NOT_AVAILABLE",
  "non-google-external-integrations": "PLANNED",
  "enterprise-feature-bundle": "PLANNED",
} as const satisfies Record<PublicCapabilityId, PublicCapabilityLifecycle>;

export const PUBLIC_PRODUCT_EVIDENCE_BY_ID = {
  "project-workspaces": [
    "src/lib/services/project-service.ts",
    "tests/client-project-service.test.ts",
  ],
  "text-pdf-extraction": [
    "src/lib/files/pdf-text-extraction.ts",
    "tests/pdf-content-extraction.test.ts",
  ],
  "spreadsheet-import": [
    "src/lib/services/import-service.ts",
    "tests/import-service-file-purpose-guard.test.ts",
  ],
  "scanned-pdf-detection": [
    "src/lib/files/pdf-text-extraction.ts",
    "tests/pdf-content-extraction.test.ts",
  ],
  "google-drive-import": [
    "src/lib/services/google-drive-integration-service.ts",
    "tests/google-drive-import-service.test.ts",
  ],
  "reviewed-extraction": [
    "src/lib/services/source-candidate-bridge-service.ts",
    "tests/source-review-routes.test.ts",
  ],
  "boq-management": [
    "src/lib/services/boq-validation-service.ts",
    "tests/boq-core-workflow.test.ts",
  ],
  "visible-calculations": [
    "src/lib/services/quantity-calculation-service.ts",
    "tests/guided-boq-measurement-workflow.test.ts",
  ],
  "voice-proposals": [
    "src/lib/voice/voice-command-interpreter.ts",
    "tests/voice-command-runtime.test.ts",
  ],
  validation: [
    "src/lib/services/boq-validation-service.ts",
    "tests/boq-lock-validation.test.ts",
  ],
  "professional-outputs": [
    "src/lib/services/document-generation-service.ts",
    "tests/document-generation-service.test.ts",
  ],
  "document-templates": [
    "src/lib/services/document-template-service.ts",
    "tests/template-governance-service.test.ts",
  ],
  "technical-report-generation": [
    "src/lib/services/technical-report-service.ts",
    "tests/technical-report-service.test.ts",
  ],
  "source-attribution": [
    "src/lib/services/boq-item-source-service.ts",
    "tests/structured-source-candidate-bridge.test.ts",
  ],
  "industry-packages": [
    "src/lib/entitlements/package-entitlement-service.ts",
    "tests/catalogue-package-integrity.test.ts",
  ],
  "commercial-access": [
    "src/lib/services/commerce-checkout-service.ts",
    "tests/commerce-checkout-service.test.ts",
  ],
  "automatic-drawing-takeoff": [
    "src/lib/calculations/required-dimensions-registry.ts",
    "tests/guided-boq-measurement-workflow.test.ts",
  ],
  "model-file-import": [
    "src/lib/integrations/provider-registry.ts",
    "tests/integrations-1a-completion.test.ts",
  ],
  "scanned-pdf-ocr": [
    "src/lib/files/pdf-text-extraction.ts",
    "tests/public-product-truth.test.ts",
  ],
  "typed-multi-change-proposals": [
    "src/lib/voice/voice-command-interpreter.ts",
    "tests/voice-command-runtime.test.ts",
  ],
  "single-sign-on": [
    "src/lib/services/auth-service.ts",
    "tests/auth-service.test.ts",
  ],
  "non-google-external-integrations": [
    "src/lib/integrations/provider-registry.ts",
    "tests/integrations-1a-completion.test.ts",
  ],
  "enterprise-feature-bundle": [
    "prisma/seed-data/commerce-products.ts",
    "tests/commerce-plan-mapping.test.ts",
  ],
} as const satisfies Record<PublicCapabilityId, readonly string[]>;

export const PUBLIC_PRODUCT_TRUTH_MATRIX: readonly PublicCapability[] =
  PUBLIC_CAPABILITY_DEFINITIONS.map((capability) => ({
    ...capability,
    lifecycle: PUBLIC_PRODUCT_LIFECYCLE_BY_ID[capability.id],
    evidencePaths: PUBLIC_PRODUCT_EVIDENCE_BY_ID[capability.id],
  }));

export const PUBLIC_CAPABILITIES = PUBLIC_PRODUCT_TRUTH_MATRIX;

export function getPublicCapability(id: PublicCapabilityId): PublicCapability {
  const capability = PUBLIC_CAPABILITIES.find((entry) => entry.id === id);
  if (!capability) {
    throw new Error(`Unknown public capability: ${id}`);
  }
  return capability;
}

export function localizePublicCapability(
  capability: PublicCapability,
  translate: TranslateFn,
): PublicCapability {
  switch (capability.id) {
    case "technical-report-generation":
      return {
        ...capability,
        limitation: translate("publicContent.productTruth.technicalReportLimitation"),
      };
    case "commercial-access":
      return {
        ...capability,
        summary: translate("publicContent.productTruth.commercialSummary"),
        limitation: translate("publicContent.productTruth.commercialLimitation"),
      };
    case "non-google-external-integrations":
      return {
        ...capability,
        name: translate("publicContent.productTruth.nonGoogleIntegrationsName"),
        summary: translate("publicContent.productTruth.nonGoogleIntegrationsSummary"),
      };
    case "enterprise-feature-bundle":
      return {
        ...capability,
        name: translate("publicContent.productTruth.enterpriseBundleName"),
        summary: translate("publicContent.productTruth.enterpriseBundleSummary"),
      };
    default:
      return capability;
  }
}

export function getPublicCapabilityForDisplay(
  id: PublicCapabilityId,
  translate: TranslateFn,
): PublicCapability {
  return localizePublicCapability(getPublicCapability(id), translate);
}

export function getPublicCapabilitiesForDisplay(
  translate: TranslateFn,
): readonly PublicCapability[] {
  return PUBLIC_CAPABILITIES.map((capability) =>
    localizePublicCapability(capability, translate),
  );
}
