import en from "@/lib/i18n/dictionaries/en";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/translate";

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
  "Quantara is AI-assisted BOQ measurement and quantity calculation software for construction professionals.";

export const QUANTARA_WORKFLOW_TRUTH =
  "Quantara brings project sources, reviewable extraction, guided measurement, deterministic quantity calculations and professional BOQ workflows together in one controlled platform. Review source-linked or professionally entered dimensions, see the engineering equation and calculated quantity, and confirm the result into your BOQ workflow.";

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
    name: "Guided BOQ measurement and quantity calculations",
    status: "AVAILABLE",
    summary: "For supported calculation types, Quantara uses reviewed source-linked or professionally entered dimensions to calculate BOQ quantities with deterministic engineering formulas, displaying the equation and proposed result for professional confirmation before governed BOQ use.",
    limitation: "Supported calculation types require the applicable dimensions and professional confirmation; universal unattended drawing-geometry takeoff is a separate capability boundary.",
  },
  {
    id: "voice-proposals",
    name: "Voice-assisted measurement and BOQ editing",
    status: "AVAILABLE",
    summary: "Use voice in supported BOQ contexts to enter or correct measurements and propose supported item changes for professional review and confirmation.",
    limitation: "Voice changes remain review and confirmation controlled; no voice change is applied to governed BOQ data without the user's confirmation.",
  },
  {
    id: "autodesk-dwg-analysis",
    name: "Autodesk / AutoCAD DWG analysis",
    status: "CONTROLLED_ACCESS",
    summary: "Connect a supported Autodesk account, select supported DWG files, and create traceable Quantara review candidates from Autodesk model metadata and properties.",
    limitation: "DWG-derived information remains subject to professional review. Quantara does not automatically treat arbitrary drawing properties as confirmed final BOQ quantities.",
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
    id: "client-proposals",
    name: "Client proposal links",
    status: "AVAILABLE",
    summary: "Generate a secure, token-gated proposal link from a reviewed BOQ revision or a completed technical report, with optional passcode protection, an expiry date and revoke, reopen or regenerate controls, for external client review.",
    limitation: "Creating a proposal is subject to the account's plan entitlement, and each proposal is tied to the specific BOQ revision or completed technical report it was created from, not the live editable BOQ.",
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
    summary: "Keep source identity and available evidence references with supported project records, including BOQ items reused from the company library.",
    limitation: "Quantara does not claim complete end-to-end traceability for every BOQ field and generated output.",
  },
  {
    id: "industry-packages",
    name: "Catalogue and industry packages",
    status: "CONTROLLED_ACCESS",
    summary: "Use governed catalogue or industry-package data where the company has the required entitlement, including saving premium items into the company's reusable library.",
    limitation: "Package availability and access vary; the public website does not represent every package as included.",
  },
  {
    id: "company-library",
    name: "Company library of reusable BOQ items",
    status: "AVAILABLE",
    summary: "Save reviewed BOQ items into a company-wide library with versions and variants, track item usage across projects, and mark favorites for faster reuse in future BOQs.",
    limitation: "Premium library items still depend on the company's catalogue or industry-package entitlement, and every reused item remains subject to professional review in its new BOQ context.",
  },
  {
    id: "bilingual-rtl-interface",
    name: "English and Arabic interface with RTL",
    status: "AVAILABLE",
    summary: "Use Quantara in English or Arabic, with a right-to-left interface in Arabic.",
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
    name: "Unattended arbitrary drawing-geometry takeoff",
    status: "NOT_AVAILABLE",
    summary: "Quantara does not make a blanket claim of fully unattended computer-vision takeoff that derives final quantities from arbitrary drawing geometry without professional review. This limitation does not apply to Quantara's available guided BOQ measurement, deterministic quantity calculation, or supported drawing/DWG data-extraction workflows.",
  },
  {
    id: "model-file-import",
    name: "Generic CAD/BIM/IFC model quantity extraction",
    status: "NOT_AVAILABLE",
    summary: "Generic CAD/BIM/IFC model quantity extraction is not claimed. This does not limit supported Autodesk / AutoCAD DWG analysis, which creates traceable review candidates from model metadata and properties.",
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

type CapabilityTranslationKeys = {
  name: TranslationKey;
  summary: TranslationKey;
  limitation?: TranslationKey;
};

const PUBLIC_CAPABILITY_REGISTER_KEYS = {
  "project-workspaces": {
    name: "publicContent.capabilityRegister.capabilities.projectWorkspaces.name",
    summary: "publicContent.capabilityRegister.capabilities.projectWorkspaces.summary",
  },
  "text-pdf-extraction": {
    name: "publicContent.capabilityRegister.capabilities.textPdfExtraction.name",
    summary: "publicContent.capabilityRegister.capabilities.textPdfExtraction.summary",
    limitation: "publicContent.capabilityRegister.capabilities.textPdfExtraction.limitation",
  },
  "spreadsheet-import": {
    name: "publicContent.capabilityRegister.capabilities.spreadsheetImport.name",
    summary: "publicContent.capabilityRegister.capabilities.spreadsheetImport.summary",
    limitation: "publicContent.capabilityRegister.capabilities.spreadsheetImport.limitation",
  },
  "scanned-pdf-detection": {
    name: "publicContent.capabilityRegister.capabilities.scannedPdfDetection.name",
    summary: "publicContent.capabilityRegister.capabilities.scannedPdfDetection.summary",
    limitation: "publicContent.capabilityRegister.capabilities.scannedPdfDetection.limitation",
  },
  "google-drive-import": {
    name: "publicContent.capabilityRegister.capabilities.googleDriveImport.name",
    summary: "publicContent.capabilityRegister.capabilities.googleDriveImport.summary",
    limitation: "publicContent.capabilityRegister.capabilities.googleDriveImport.limitation",
  },
  "reviewed-extraction": {
    name: "publicContent.capabilityRegister.capabilities.reviewedExtraction.name",
    summary: "publicContent.capabilityRegister.capabilities.reviewedExtraction.summary",
  },
  "boq-management": {
    name: "publicContent.capabilityRegister.capabilities.boqManagement.name",
    summary: "publicContent.capabilityRegister.capabilities.boqManagement.summary",
  },
  "visible-calculations": {
    name: "publicContent.capabilityRegister.capabilities.visibleCalculations.name",
    summary: "publicContent.capabilityRegister.capabilities.visibleCalculations.summary",
    limitation: "publicContent.capabilityRegister.capabilities.visibleCalculations.limitation",
  },
  "voice-proposals": {
    name: "publicContent.capabilityRegister.capabilities.voiceProposals.name",
    summary: "publicContent.capabilityRegister.capabilities.voiceProposals.summary",
    limitation: "publicContent.capabilityRegister.capabilities.voiceProposals.limitation",
  },
  "autodesk-dwg-analysis": {
    name: "publicContent.capabilityRegister.capabilities.autodeskDwgAnalysis.name",
    summary: "publicContent.capabilityRegister.capabilities.autodeskDwgAnalysis.summary",
    limitation: "publicContent.capabilityRegister.capabilities.autodeskDwgAnalysis.limitation",
  },
  validation: {
    name: "publicContent.capabilityRegister.capabilities.validation.name",
    summary: "publicContent.capabilityRegister.capabilities.validation.summary",
  },
  "professional-outputs": {
    name: "publicContent.capabilityRegister.capabilities.professionalOutputs.name",
    summary: "publicContent.capabilityRegister.capabilities.professionalOutputs.summary",
    limitation: "publicContent.capabilityRegister.capabilities.professionalOutputs.limitation",
  },
  "client-proposals": {
    name: "publicContent.capabilityRegister.capabilities.clientProposals.name",
    summary: "publicContent.capabilityRegister.capabilities.clientProposals.summary",
    limitation: "publicContent.capabilityRegister.capabilities.clientProposals.limitation",
  },
  "document-templates": {
    name: "publicContent.capabilityRegister.capabilities.documentTemplates.name",
    summary: "publicContent.capabilityRegister.capabilities.documentTemplates.summary",
    limitation: "publicContent.capabilityRegister.capabilities.documentTemplates.limitation",
  },
  "technical-report-generation": {
    name: "publicContent.capabilityRegister.capabilities.technicalReportGeneration.name",
    summary: "publicContent.capabilityRegister.capabilities.technicalReportGeneration.summary",
    limitation: "publicContent.capabilityRegister.capabilities.technicalReportGeneration.limitation",
  },
  "source-attribution": {
    name: "publicContent.capabilityRegister.capabilities.sourceAttribution.name",
    summary: "publicContent.capabilityRegister.capabilities.sourceAttribution.summary",
    limitation: "publicContent.capabilityRegister.capabilities.sourceAttribution.limitation",
  },
  "industry-packages": {
    name: "publicContent.capabilityRegister.capabilities.industryPackages.name",
    summary: "publicContent.capabilityRegister.capabilities.industryPackages.summary",
    limitation: "publicContent.capabilityRegister.capabilities.industryPackages.limitation",
  },
  "company-library": {
    name: "publicContent.capabilityRegister.capabilities.companyLibrary.name",
    summary: "publicContent.capabilityRegister.capabilities.companyLibrary.summary",
    limitation: "publicContent.capabilityRegister.capabilities.companyLibrary.limitation",
  },
  "bilingual-rtl-interface": {
    name: "publicContent.capabilityRegister.capabilities.bilingualRtlInterface.name",
    summary: "publicContent.capabilityRegister.capabilities.bilingualRtlInterface.summary",
  },
  "commercial-access": {
    name: "publicContent.capabilityRegister.capabilities.commercialAccess.name",
    summary: "publicContent.capabilityRegister.capabilities.commercialAccess.summary",
    limitation: "publicContent.capabilityRegister.capabilities.commercialAccess.limitation",
  },
  "automatic-drawing-takeoff": {
    name: "publicContent.capabilityRegister.capabilities.automaticDrawingTakeoff.name",
    summary: "publicContent.capabilityRegister.capabilities.automaticDrawingTakeoff.summary",
  },
  "model-file-import": {
    name: "publicContent.capabilityRegister.capabilities.modelFileImport.name",
    summary: "publicContent.capabilityRegister.capabilities.modelFileImport.summary",
  },
  "scanned-pdf-ocr": {
    name: "publicContent.capabilityRegister.capabilities.scannedPdfOcr.name",
    summary: "publicContent.capabilityRegister.capabilities.scannedPdfOcr.summary",
  },
  "typed-multi-change-proposals": {
    name: "publicContent.capabilityRegister.capabilities.typedMultiChangeProposals.name",
    summary: "publicContent.capabilityRegister.capabilities.typedMultiChangeProposals.summary",
  },
  "single-sign-on": {
    name: "publicContent.capabilityRegister.capabilities.singleSignOn.name",
    summary: "publicContent.capabilityRegister.capabilities.singleSignOn.summary",
  },
  "non-google-external-integrations": {
    name: "publicContent.capabilityRegister.capabilities.nonGoogleExternalIntegrations.name",
    summary: "publicContent.capabilityRegister.capabilities.nonGoogleExternalIntegrations.summary",
  },
  "enterprise-feature-bundle": {
    name: "publicContent.capabilityRegister.capabilities.enterpriseFeatureBundle.name",
    summary: "publicContent.capabilityRegister.capabilities.enterpriseFeatureBundle.summary",
  },
} as const satisfies Record<PublicCapabilityId, CapabilityTranslationKeys>;

const PUBLIC_CAPABILITY_STATUS_KEYS = {
  AVAILABLE: {
    label: "publicContent.capabilityRegister.status.availableLabel",
    description: "publicContent.capabilityRegister.status.availableDescription",
  },
  CONTROLLED_ACCESS: {
    label: "publicContent.capabilityRegister.status.controlledLabel",
    description: "publicContent.capabilityRegister.status.controlledDescription",
  },
  LIMITED: {
    label: "publicContent.capabilityRegister.status.limitedLabel",
    description: "publicContent.capabilityRegister.status.limitedDescription",
  },
  NOT_AVAILABLE: {
    label: "publicContent.capabilityRegister.status.unavailableLabel",
    description: "publicContent.capabilityRegister.status.unavailableDescription",
  },
} as const satisfies Record<
  PublicCapabilityStatus,
  { label: TranslationKey; description: TranslationKey }
>;

export const PUBLIC_PRODUCT_LIFECYCLE_BY_ID = {
  "project-workspaces": "LIVE",
  "text-pdf-extraction": "LIVE",
  "spreadsheet-import": "LIVE",
  "scanned-pdf-detection": "LIVE",
  "google-drive-import": "BETA_LIMITED",
  "reviewed-extraction": "LIVE",
  "boq-management": "LIVE",
  "visible-calculations": "LIVE",
  "voice-proposals": "LIVE",
  "autodesk-dwg-analysis": "BETA_LIMITED",
  validation: "LIVE",
  "professional-outputs": "LIVE",
  "client-proposals": "LIVE",
  "document-templates": "LIVE",
  "technical-report-generation": "BETA_LIMITED",
  "source-attribution": "LIVE",
  "industry-packages": "BETA_LIMITED",
  "company-library": "LIVE",
  "bilingual-rtl-interface": "LIVE",
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
  "autodesk-dwg-analysis": [
    "src/lib/services/autodesk-candidate-service.ts",
    "tests/autodesk-integration.test.ts",
  ],
  validation: [
    "src/lib/services/boq-validation-service.ts",
    "tests/boq-lock-validation.test.ts",
  ],
  "professional-outputs": [
    "src/lib/services/document-generation-service.ts",
    "tests/document-generation-service.test.ts",
  ],
  "client-proposals": [
    "src/lib/services/client-proposal-service.ts",
    "tests/client-proposal-service.test.ts",
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
  "company-library": [
    "src/lib/services/company-library-service.ts",
    "tests/phase7-entitlements-and-library.test.ts",
  ],
  "bilingual-rtl-interface": [
    "src/lib/i18n/server-locale.ts",
    "tests/i18n-dictionary-parity.test.ts",
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

function localizePublicCapabilityRegisterEntry(
  capability: PublicCapability,
  translate: TranslateFn,
): PublicCapability {
  const keys: CapabilityTranslationKeys =
    PUBLIC_CAPABILITY_REGISTER_KEYS[capability.id as PublicCapabilityId];
  return {
    ...capability,
    name: translate(keys.name),
    summary: translate(keys.summary),
    ...(keys.limitation ? { limitation: translate(keys.limitation) } : {}),
  };
}

export function getPublicCapabilityRegisterEntry(
  id: PublicCapabilityId,
  translate: TranslateFn,
): PublicCapability {
  return localizePublicCapabilityRegisterEntry(getPublicCapability(id), translate);
}

export function getPublicCapabilityRegisterEntries(
  translate: TranslateFn,
): readonly PublicCapability[] {
  return PUBLIC_CAPABILITIES.map((capability) =>
    localizePublicCapabilityRegisterEntry(capability, translate),
  );
}

export function getPublicCapabilityStatusForDisplay(
  status: PublicCapabilityStatus,
  translate: TranslateFn,
): { label: string; description: string } {
  const keys = PUBLIC_CAPABILITY_STATUS_KEYS[status];
  return {
    label: translate(keys.label),
    description: translate(keys.description),
  };
}

export function getQuantaraProductTruthForDisplay(translate: TranslateFn): {
  entityDefinition: string;
  workflowTruth: string;
  professionalReviewNotice: string;
} {
  return {
    entityDefinition: translate("publicContent.capabilityRegister.entityDefinition"),
    workflowTruth: translate("publicContent.capabilityRegister.workflowTruth"),
    professionalReviewNotice: translate(
      "publicContent.capabilityRegister.professionalReviewNotice",
    ),
  };
}
