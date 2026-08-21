export type DocumentTemplateStyleConfig = {
  direction: "ltr" | "rtl";
  coverStyle: "light" | "dark" | "none";
  primaryColor: string;
  accentColor: string;
  fontFamily: "sans" | "arabic-naskh";
  showLogo: boolean;
  showPageNumbers: boolean;
  footerText: string;
  watermarkDraftText: string;
};

export type DocumentTemplateColumnConfig = {
  specification: boolean;
  roomOrZone: boolean;
  drawingReference: boolean;
  notes: boolean;
  brandModel: boolean;
};

export type DocumentTemplateContentConfig = {
  showCoverPage: boolean;
  showCompanyInfo: boolean;
  showProjectInfo: boolean;
  showTermsSection: boolean;
  showExclusionsSection: boolean;
  showSignatureSection: boolean;
  showInternalCostFieldsToClient: boolean;
  columns: DocumentTemplateColumnConfig;
  denseTechnicalTable: boolean;
};

export const DEFAULT_STYLE_CONFIG: DocumentTemplateStyleConfig = {
  direction: "ltr",
  coverStyle: "light",
  primaryColor: "#0B1D3A",
  accentColor: "#2563EB",
  fontFamily: "sans",
  showLogo: true,
  showPageNumbers: true,
  footerText: "",
  watermarkDraftText: "DRAFT — NOT FOR CLIENT ISSUE",
};

export const DEFAULT_CONTENT_CONFIG: DocumentTemplateContentConfig = {
  showCoverPage: true,
  showCompanyInfo: true,
  showProjectInfo: true,
  showTermsSection: true,
  showExclusionsSection: true,
  showSignatureSection: true,
  showInternalCostFieldsToClient: false,
  columns: {
    specification: true,
    roomOrZone: true,
    drawingReference: true,
    notes: true,
    brandModel: false,
  },
  denseTechnicalTable: false,
};

/** `Partial<DocumentTemplateContentConfig>` only makes `columns` optional as a whole — it does not
 * make the individual column flags inside it optional. This type does, so partial updates (e.g.
 * `{columns: {specification: false}}`) type-check without requiring every column flag to be repeated. */
export type PartialDocumentTemplateContentConfig = Partial<Omit<DocumentTemplateContentConfig, "columns">> & {
  columns?: Partial<DocumentTemplateColumnConfig>;
};

export function mergeStyleConfig(overrides: Partial<DocumentTemplateStyleConfig> | null | undefined): DocumentTemplateStyleConfig {
  return { ...DEFAULT_STYLE_CONFIG, ...(overrides ?? {}) };
}

export function mergeContentConfig(overrides: PartialDocumentTemplateContentConfig | null | undefined): DocumentTemplateContentConfig {
  const columns: DocumentTemplateColumnConfig = { ...DEFAULT_CONTENT_CONFIG.columns, ...(overrides?.columns ?? {}) };
  return { ...DEFAULT_CONTENT_CONFIG, ...(overrides ?? {}), columns };
}
