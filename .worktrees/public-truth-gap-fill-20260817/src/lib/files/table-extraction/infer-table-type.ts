import { ExtractedTableType, ProjectFileClassification } from "@prisma/client";

/** Reuses the file's own classification (sub-phase 3) rather than a second, separate table-type-detection heuristic. */
const CLASSIFICATION_TO_TABLE_TYPE: Partial<Record<ProjectFileClassification, ExtractedTableType>> = {
  [ProjectFileClassification.SUPPLIER_PRICE_LIST]: ExtractedTableType.SUPPLIER_QUOTATION,
  [ProjectFileClassification.EXISTING_BOQ]: ExtractedTableType.EXISTING_BOQ,
  [ProjectFileClassification.FURNITURE_SCHEDULE]: ExtractedTableType.FURNITURE_SCHEDULE,
  [ProjectFileClassification.EQUIPMENT_SCHEDULE]: ExtractedTableType.EQUIPMENT_SCHEDULE,
  [ProjectFileClassification.DOOR_SCHEDULE]: ExtractedTableType.DOOR_SCHEDULE,
  [ProjectFileClassification.WINDOW_SCHEDULE]: ExtractedTableType.WINDOW_SCHEDULE,
  [ProjectFileClassification.FINISH_SCHEDULE]: ExtractedTableType.FINISH_SCHEDULE,
  [ProjectFileClassification.MATERIAL_SCHEDULE]: ExtractedTableType.MATERIAL_SCHEDULE,
};

export function inferTableType(fileClassification: ProjectFileClassification): ExtractedTableType {
  return CLASSIFICATION_TO_TABLE_TYPE[fileClassification] ?? ExtractedTableType.GENERIC_TABLE;
}
