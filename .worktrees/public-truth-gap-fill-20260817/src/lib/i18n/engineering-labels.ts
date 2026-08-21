import type {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  QuantityCalculationType,
} from "@prisma/client";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/translate";

export type ItemSearchSource =
  | "COMPANY_LIBRARY"
  | "RECENT"
  | "FAVORITE"
  | "MASTER_PACKAGE"
  | "PREVIOUS_PROJECT"
  | "SUPPLIER_CATALOGUE"
  | "LOCKED_PREVIEW";

export type RegisteredDimensionKey =
  | "netFloorArea"
  | "wastagePercentage"
  | "ceilingArea"
  | "wallLength"
  | "wallHeight"
  | "openingsArea"
  | "wallArea"
  | "coats"
  | "length"
  | "height"
  | "faces"
  | "width"
  | "depth"
  | "perimeter"
  | "totalDoorWidths"
  | "verifiedRouteLength"
  | "approvedAllowancePercentage"
  | "ductPerimeter"
  | "routeLength"
  | "verticalDrops"
  | "approvedTerminationAllowance"
  | "scheduleQuantity"
  | "barLength"
  | "unitWeightPerMeter"
  | "exposedConcreteSurfaceArea"
  | "verifiedCount";

export const EXTRACTED_ENTITY_STATUS_LABEL_KEYS = {
  EXTRACTED: "boqEditor.entityStatusExtracted",
  NEEDS_REVIEW: "boqEditor.entityStatusNeedsReview",
  CONFIRMED: "boqEditor.entityStatusConfirmed",
  CORRECTED: "boqEditor.entityStatusCorrected",
  REJECTED: "boqEditor.entityStatusRejected",
  IMPORTED: "boqEditor.entityStatusImported",
} as const satisfies Record<ExtractedEntityStatus, TranslationKey>;

export const EXTRACTED_ENTITY_TYPE_LABEL_KEYS = {
  ROOM: "boqEditor.entityTypeRoom",
  FURNITURE: "boqEditor.entityTypeFurniture",
  EQUIPMENT: "boqEditor.entityTypeEquipment",
  MATERIAL: "boqEditor.entityTypeMaterial",
  FIXTURE: "boqEditor.entityTypeFixture",
  ELECTRICAL_POINT: "boqEditor.entityTypeElectricalPoint",
  LIGHT_FIXTURE: "boqEditor.entityTypeLightFixture",
  HVAC_EQUIPMENT: "boqEditor.entityTypeHvacEquipment",
  FAN: "boqEditor.entityTypeFan",
  DUCT: "boqEditor.entityTypeDuct",
  DIFFUSER: "boqEditor.entityTypeDiffuser",
  GRILLE: "boqEditor.entityTypeGrille",
  DAMPER: "boqEditor.entityTypeDamper",
  PIPE: "boqEditor.entityTypePipe",
  VALVE: "boqEditor.entityTypeValve",
  SANITARY_FIXTURE: "boqEditor.entityTypeSanitaryFixture",
  FIRE_FIGHTING_ITEM: "boqEditor.entityTypeFireFightingItem",
  FIRE_ALARM_ITEM: "boqEditor.entityTypeFireAlarmItem",
  DOOR: "boqEditor.entityTypeDoor",
  WINDOW: "boqEditor.entityTypeWindow",
  PARTITION: "boqEditor.entityTypePartition",
  WALL_FINISH: "boqEditor.entityTypeWallFinish",
  FLOOR_FINISH: "boqEditor.entityTypeFloorFinish",
  CEILING_FINISH: "boqEditor.entityTypeCeilingFinish",
  STRUCTURAL_ELEMENT: "boqEditor.entityTypeStructuralElement",
  SCHEDULE_ROW: "boqEditor.entityTypeScheduleRow",
  ANNOTATION: "boqEditor.entityTypeAnnotation",
  CUSTOM: "boqEditor.entityTypeCustom",
} as const satisfies Record<ExtractedEntityType, TranslationKey>;

export const EXTRACTION_METHOD_LABEL_KEYS = {
  TEXT_LAYER: "boqEditor.extractionMethodTextLayer",
  OCR: "boqEditor.extractionMethodOcr",
  TABLE_PARSER: "boqEditor.extractionMethodTableParser",
  VECTOR_BLOCK: "boqEditor.extractionMethodVectorBlock",
  VISION_MODEL: "boqEditor.extractionMethodVisionModel",
  GEOMETRY_ENGINE: "boqEditor.extractionMethodGeometryEngine",
  MANUAL: "boqEditor.extractionMethodManual",
  HYBRID: "boqEditor.extractionMethodHybrid",
} as const satisfies Record<ExtractionMethod, TranslationKey>;

export const CALCULATION_TYPE_LABEL_KEYS = {
  COUNT: "measurement.calculationCount",
  AREA: "measurement.calculationArea",
  PERIMETER: "measurement.calculationPerimeter",
  LENGTH: "measurement.calculationLength",
  VOLUME: "measurement.calculationVolume",
  WALL_AREA: "measurement.calculationWallArea",
  FLOOR_AREA: "measurement.calculationFloorArea",
  CEILING_AREA: "measurement.calculationCeilingArea",
  SKIRTING_LENGTH: "measurement.calculationSkirtingLength",
  DUCT_SURFACE_AREA: "measurement.calculationDuctSurfaceArea",
  PIPE_LENGTH: "measurement.calculationPipeLength",
  CABLE_LENGTH: "measurement.calculationCableLength",
  CONCRETE_VOLUME: "measurement.calculationConcreteVolume",
  REINFORCEMENT_WEIGHT: "measurement.calculationReinforcementWeight",
  FORMWORK_AREA: "measurement.calculationFormworkArea",
  EXCAVATION_VOLUME: "measurement.calculationExcavationVolume",
  PAINT_AREA: "measurement.calculationPaintArea",
  PARTITION_AREA: "measurement.calculationPartitionArea",
  CUSTOM: "measurement.calculationCustom",
} as const satisfies Record<QuantityCalculationType, TranslationKey>;

export const DIMENSION_LABEL_KEYS = {
  netFloorArea: "measurement.dimensionNetFloorArea",
  wastagePercentage: "measurement.dimensionWastagePercentage",
  ceilingArea: "measurement.dimensionCeilingArea",
  wallLength: "measurement.dimensionWallLength",
  wallHeight: "measurement.dimensionWallHeight",
  openingsArea: "measurement.dimensionOpeningsArea",
  wallArea: "measurement.dimensionWallArea",
  coats: "measurement.dimensionCoats",
  length: "measurement.dimensionLength",
  height: "measurement.dimensionHeight",
  faces: "measurement.dimensionFaces",
  width: "measurement.dimensionWidth",
  depth: "measurement.dimensionDepth",
  perimeter: "measurement.dimensionPerimeter",
  totalDoorWidths: "measurement.dimensionTotalDoorWidths",
  verifiedRouteLength: "measurement.dimensionVerifiedRouteLength",
  approvedAllowancePercentage: "measurement.dimensionApprovedAllowancePercentage",
  ductPerimeter: "measurement.dimensionDuctPerimeter",
  routeLength: "measurement.dimensionRouteLength",
  verticalDrops: "measurement.dimensionVerticalDrops",
  approvedTerminationAllowance: "measurement.dimensionApprovedTerminationAllowance",
  scheduleQuantity: "measurement.dimensionScheduleQuantity",
  barLength: "measurement.dimensionBarLength",
  unitWeightPerMeter: "measurement.dimensionUnitWeightPerMeter",
  exposedConcreteSurfaceArea: "measurement.dimensionExposedConcreteSurfaceArea",
  verifiedCount: "measurement.dimensionVerifiedCount",
} as const satisfies Record<RegisteredDimensionKey, TranslationKey>;

export const SEARCH_SOURCE_LABEL_KEYS = {
  COMPANY_LIBRARY: "boqEditor.searchSourceCompanyLibrary",
  RECENT: "boqEditor.searchSourceRecent",
  FAVORITE: "boqEditor.searchSourceFavorite",
  MASTER_PACKAGE: "boqEditor.searchSourceMasterPackage",
  PREVIOUS_PROJECT: "boqEditor.searchSourcePreviousProject",
  SUPPLIER_CATALOGUE: "boqEditor.searchSourceSupplierCatalogue",
  LOCKED_PREVIEW: "boqEditor.searchSourceLockedPreview",
} as const satisfies Record<ItemSearchSource, TranslationKey>;

function translateMappedLabel(
  value: string,
  labels: Readonly<Partial<Record<string, TranslationKey>>>,
  t: TranslateFn,
  fallback: string,
): string {
  const key = labels[value];
  return key ? t(key) : fallback;
}

export function translateExtractedEntityStatus(status: ExtractedEntityStatus, t: TranslateFn): string {
  return t(EXTRACTED_ENTITY_STATUS_LABEL_KEYS[status]);
}

export function translateExtractedEntityType(type: ExtractedEntityType, t: TranslateFn): string {
  return t(EXTRACTED_ENTITY_TYPE_LABEL_KEYS[type]);
}

export function translateExtractionMethod(method: ExtractionMethod, t: TranslateFn): string {
  return t(EXTRACTION_METHOD_LABEL_KEYS[method]);
}

export function translateCalculationType(type: QuantityCalculationType, t: TranslateFn): string {
  return t(CALCULATION_TYPE_LABEL_KEYS[type]);
}

export function translateDimensionLabel(key: string, t: TranslateFn, fallback: string): string {
  return translateMappedLabel(key, DIMENSION_LABEL_KEYS, t, fallback);
}

export function translateSearchSource(source: ItemSearchSource, t: TranslateFn): string {
  return t(SEARCH_SOURCE_LABEL_KEYS[source]);
}
