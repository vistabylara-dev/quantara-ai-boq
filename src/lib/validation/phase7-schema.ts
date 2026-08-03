import { z } from "zod";

const optionalUuid = z.string().uuid().optional();
const nullableUuid = z.string().uuid().nullable().optional();

export const companyLibraryCreateSchema = z
  .object({
    companyItemCode: z.string().trim().min(1, "Item code is required.").max(100),
    name: z.string().trim().min(1, "Name is required.").max(255),
    description: z.string().trim().max(4_000).optional(),
    specificationJson: z.unknown().optional(),
    technicalDataJson: z.unknown().optional(),
    unit: z.string().trim().min(1, "Unit is required.").max(50),
    disciplineId: nullableUuid,
    categoryId: nullableUuid,
    defaultSupplierId: nullableUuid,
    defaultCost: z.coerce.number().min(0).optional(),
    defaultMarginMode: z.enum(["MARKUP", "GROSS_MARGIN"]).optional(),
    defaultMargin: z.coerce.number().optional(),
    defaultSellingRate: z.coerce.number().min(0).optional(),
    tagsJson: z.array(z.string()).optional(),
    searchKeywordsJson: z.array(z.string()).optional(),
  })
  .strict();

export const companyLibraryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(4_000).optional(),
    specificationJson: z.unknown().optional(),
    technicalDataJson: z.unknown().optional(),
    unit: z.string().trim().min(1).max(50).optional(),
    categoryId: nullableUuid,
    defaultSupplierId: nullableUuid,
    defaultRateCatalogueItemId: nullableUuid,
    defaultCost: z.coerce.number().min(0).optional(),
    defaultMarginMode: z.enum(["MARKUP", "GROSS_MARGIN"]).optional(),
    defaultMargin: z.coerce.number().optional(),
    defaultSellingRate: z.coerce.number().min(0).optional(),
    tagsJson: z.array(z.string()).optional(),
    searchKeywordsJson: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    changeReason: z.string().trim().max(500).optional(),
  })
  .strict();

export const companyLibraryFavoriteSchema = z.object({ isFavorite: z.boolean() }).strict();
export const companyLibraryActiveSchema = z.object({ isActive: z.boolean() }).strict();

export const companyLibraryFromMasterSchema = z
  .object({ masterItemId: z.string().uuid(), companyItemCode: z.string().trim().max(100).optional(), name: z.string().trim().max(255).optional() })
  .strict();

export const companyLibraryFromCatalogueSchema = z
  .object({ rateCatalogueItemId: z.string().uuid(), companyItemCode: z.string().trim().max(100).optional(), name: z.string().trim().max(255).optional() })
  .strict();

export const companyLibraryFromBoqSchema = z
  .object({ boqItemId: z.string().uuid(), companyItemCode: z.string().trim().max(100).optional(), name: z.string().trim().max(255).optional() })
  .strict();

export const companyLibraryVariantSchema = z
  .object({
    name: z.string().trim().min(1, "Variant name is required.").max(255),
    variantCode: z.string().trim().min(1, "Variant code is required.").max(100),
    specificationOverridesJson: z.unknown().optional(),
    technicalOverridesJson: z.unknown().optional(),
    unit: z.string().trim().max(50).optional(),
    defaultSupplierId: nullableUuid,
    defaultCost: z.coerce.number().min(0).optional(),
    defaultSellingRate: z.coerce.number().min(0).optional(),
  })
  .strict();

export const boqItemFromSourceSchema = z
  .object({
    sourceType: z.enum(["MANUAL", "MASTER_ITEM", "COMPANY_LIBRARY", "RATE_CATALOGUE", "PREVIOUS_BOQ", "IMPORT"]),
    sourceId: optionalUuid,
    sectionId: optionalUuid,
    itemNumber: z.coerce.number().int().min(1),
    quantity: z.string().trim().min(1, "Quantity is required."),
    sortOrder: z.coerce.number().int().optional(),
    drawingReference: z.string().trim().max(255).optional(),
    roomOrZone: z.string().trim().max(255).optional(),
    overrides: z
      .object({
        itemCode: z.string().trim().max(100).optional(),
        category: z.string().trim().max(255).optional(),
        description: z.string().trim().max(2_000).optional(),
        specification: z.string().trim().max(2_000).optional(),
        unit: z.string().trim().max(50).optional(),
        unitCost: z.coerce.number().min(0).optional(),
        marginMode: z.enum(["MARKUP", "GROSS_MARGIN"]).optional(),
        marginPercentage: z.coerce.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const brandingUpdateSchema = z
  .object({
    primaryColor: z.string().trim().max(20).optional(),
    secondaryColor: z.string().trim().max(20).optional(),
    accentColor: z.string().trim().max(20).optional(),
    documentHeaderColor: z.string().trim().max(20).optional(),
    tableHeaderColor: z.string().trim().max(20).optional(),
    coverStyle: z.string().trim().max(20).optional(),
    logoPosition: z.string().trim().max(20).optional(),
    preferredTemplateId: nullableUuid,
    emailSignatureHtml: z.string().max(20_000).optional(),
    footerText: z.string().trim().max(500).optional(),
  })
  .strict();

export const activateDevelopmentPlanSchema = z.object({ planKey: z.string().trim().min(1).max(100) }).strict();
export const activateDevelopmentPackageSchema = z.object({ packageKeyOrId: z.string().trim().min(1).max(200) }).strict();

export const importJobCreateSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    uploadedFileName: z.string().trim().min(1).max(255),
    fileContentBase64: z.string().min(1, "File content is required."),
    sourceType: z.enum(["CSV", "XLSX"]),
    destinationType: z.enum(["COMPANY_LIBRARY", "RATE_CATALOGUE", "DRAFT_BOQ", "STAGING_REVIEW"]),
    mappingTemplateId: z.string().uuid().optional(),
  })
  .strict();

export const importMappingUpdateSchema = z
  .object({
    mappingJson: z.record(z.string(), z.string().nullable()),
    saveAsTemplateName: z.string().trim().max(255).optional(),
  })
  .strict();

export const importRowActionSchema = z
  .object({
    rowIds: z.array(z.string().uuid()).min(1),
    action: z.enum(["CREATE_NEW", "SKIP", "REJECT"]),
  })
  .strict();

export const importRowUpdateSchema = z
  .object({
    normalizedDataJson: z.record(z.string(), z.string()),
  })
  .strict();
