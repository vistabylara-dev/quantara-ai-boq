export type SourceProcessingMode =
  | "PDF_TEXT_AND_PAGE_REVIEW"
  | "STRUCTURED_TABLE_EXTRACTION"
  | "IMAGE_PAGE_REVIEW"
  | "CAD_BIM_CONNECTOR_REQUIRED"
  | "SOURCE_ONLY";

export type SourceProcessingCapability = {
  mode: SourceProcessingMode;
  canClassify: true;
  canRenderPages: boolean;
  canExtractTables: boolean;
  message: string;
};

const STRUCTURED_TABLE_EXTENSIONS = new Set(["csv", "xlsx"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tif", "tiff"]);
const CAD_BIM_EXTENSIONS = new Set(["dxf", "dwg", "ifc", "rvt"]);

export function getSourceProcessingCapability(extension: string): SourceProcessingCapability {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");

  if (normalized === "pdf") {
    return {
      mode: "PDF_TEXT_AND_PAGE_REVIEW",
      canClassify: true,
      canRenderPages: true,
      canExtractTables: true,
      message:
        "PDF pages can be rendered for review and text-based schedule tables can be extracted. "
        + "Image-only/scanned pages remain OCR_REQUIRED until a real OCR engine is enabled.",
    };
  }

  if (STRUCTURED_TABLE_EXTENSIONS.has(normalized)) {
    return {
      mode: "STRUCTURED_TABLE_EXTRACTION",
      canClassify: true,
      canRenderPages: false,
      canExtractTables: true,
      message: "This structured file can be parsed for schedule/table evidence; it has no drawing-page rendering step.",
    };
  }

  if (IMAGE_EXTENSIONS.has(normalized)) {
    return {
      mode: "IMAGE_PAGE_REVIEW",
      canClassify: true,
      canRenderPages: true,
      canExtractTables: false,
      message:
        "This image can be preserved as a reviewable page. Automatic OCR/table extraction is not currently implemented.",
    };
  }

  if (CAD_BIM_EXTENSIONS.has(normalized)) {
    return {
      mode: "CAD_BIM_CONNECTOR_REQUIRED",
      canClassify: true,
      canRenderPages: false,
      canExtractTables: false,
      message:
        "This CAD/BIM source can be retained as project evidence, but native DWG/DXF/IFC/RVT model or property extraction "
        + "is not currently enabled. Use an implemented connector/conversion workflow before claiming extracted model data.",
    };
  }

  return {
    mode: "SOURCE_ONLY",
    canClassify: true,
    canRenderPages: false,
    canExtractTables: false,
    message:
      "This supported upload can be retained and classified as project evidence, but no page-rendering or structured extraction engine is enabled for it.",
  };
}
