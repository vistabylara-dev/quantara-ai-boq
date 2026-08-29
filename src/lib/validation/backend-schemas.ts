import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isFinitePrismaDecimal } from "@/lib/validation/prisma-decimal";

export const PROJECT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "NEEDS_REVIEW",
  "INTERNALLY_APPROVED",
  "SENT",
  "CLIENT_APPROVED",
  "REVISION_REQUESTED",
  "REJECTED",
  "ARCHIVED",
] as const;

export const BOQ_STATUSES = ["DRAFT", "CALCULATED", "NEEDS_VERIFICATION", "LOCKED", "ISSUED", "APPROVED"] as const;
export const BOQ_ITEM_STATUSES = ["DRAFT", "EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED", "REJECTED", "LOCKED"] as const;
export const MARGIN_MODES = ["MARKUP", "GROSS_MARGIN"] as const;
export const VERIFICATION_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export const RATE_STATUSES = ["ACTIVE", "EXPIRED", "INACTIVE"] as const;

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const boqStatusSchema = z.enum(BOQ_STATUSES);
export const boqItemStatusSchema = z.enum(BOQ_ITEM_STATUSES);
export const marginModeSchema = z.enum(MARGIN_MODES);
export const verificationSeveritySchema = z.enum(VERIFICATION_SEVERITIES);
export const rateStatusSchema = z.enum(RATE_STATUSES);

type DecimalRules = {
  field: string;
  precision: number;
  scale: number;
  minimum?: number;
  maximum?: number;
  maximumExclusive?: boolean;
};

const decimalSourceSchema = z.union([
  z.string().trim().min(1, "Decimal value cannot be empty."),
  z.number().finite(),
  z.custom<Prisma.Decimal>((value) => Prisma.Decimal.isDecimal(value), "Invalid decimal value."),
]);

function decimalSchema(rules: DecimalRules) {
  return decimalSourceSchema.transform((value, context) => {
    let parsed: Prisma.Decimal;
    try {
      parsed = new Prisma.Decimal(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${rules.field} must be a valid decimal.` });
      return z.NEVER;
    }

    if (!isFinitePrismaDecimal(parsed)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${rules.field} must be finite.` });
      return z.NEVER;
    }
    if (parsed.decimalPlaces() > rules.scale) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${rules.field} supports at most ${rules.scale} decimal places.`,
      });
    }

    const absoluteLimit = new Prisma.Decimal(10).pow(rules.precision - rules.scale);
    if (parsed.abs().greaterThanOrEqualTo(absoluteLimit)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${rules.field} exceeds Decimal(${rules.precision}, ${rules.scale}) range.`,
      });
    }
    if (rules.minimum !== undefined && parsed.lessThan(rules.minimum)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${rules.field} must be at least ${rules.minimum}.` });
    }
    if (rules.maximum !== undefined) {
      const invalid = rules.maximumExclusive
        ? parsed.greaterThanOrEqualTo(rules.maximum)
        : parsed.greaterThan(rules.maximum);
      if (invalid) {
        const qualifier = rules.maximumExclusive ? "less than" : "at most";
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${rules.field} must be ${qualifier} ${rules.maximum}.` });
      }
    }
    return parsed;
  });
}

const money = (field: string) => decimalSchema({ field, precision: 18, scale: 4, minimum: 0 });
const totalMoney = (field: string) => decimalSchema({ field, precision: 20, scale: 4, minimum: 0 });
const quantity = (field: string) => decimalSchema({ field, precision: 18, scale: 4, minimum: 0 });
const percentage = (field: string, maximum?: number, maximumExclusive = false) =>
  decimalSchema({ field, precision: 7, scale: 4, minimum: 0, maximum, maximumExclusive });

const requiredText = (label: string, maximum = 255) =>
  z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) => z.string().trim().max(maximum).optional();
const nullableText = (maximum = 2_000) => z.string().trim().max(maximum).nullable().optional();
const nullableUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().url("A valid website URL is required.").max(2_048).nullable().optional(),
);
const currencySchema = z.string().trim().regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter ISO code.").transform((value) => value.toUpperCase());
const uuidSchema = z.string().uuid("A valid UUID is required.");
const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens only.");

const dateInputSchema = z.union([z.date(), z.string().datetime({ offset: true })]).transform((value) => {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}).refine((value) => !Number.isNaN(value.getTime()), "A valid ISO date and time is required.");

export const companySchema = z.object({
  legalName: requiredText("Legal name"),
  tradeName: requiredText("Trade name"),
  email: z.string().trim().email("A valid company email is required.").max(320),
  phone: nullableText(50),
  website: nullableUrl,
  address: nullableText(1_000),
  country: nullableText(100),
  taxRegistrationNumber: nullableText(100),
  defaultCurrency: currencySchema.default("AED"),
  vatRate: percentage("VAT rate", 100).default("5"),
  defaultLanguage: requiredText("Default language", 50).default("English"),
  logoUrl: nullableText(2_048),
  authorizedSignatoryName: nullableText(255),
  authorizedSignatoryTitle: nullableText(255),
  stampUrl: nullableText(2_048),
  signatureUrl: nullableText(2_048),
  defaultTerms: nullableText(4_000),
  defaultExclusions: nullableText(4_000),
  defaultValidityDays: z.coerce.number().int().min(1).max(365).default(30),
}).strict();

export const companyUpdateSchema = companySchema.partial();

export const clientSchema = z.object({
  name: requiredText("Client name"),
  companyName: nullableText(255),
  email: z.string().trim().email("A valid client email is required.").max(320),
  phone: nullableText(50),
  address: nullableText(1_000),
}).strict();

export const clientUpdateSchema = clientSchema.partial();

export const projectSchema = z.object({
  clientId: uuidSchema,
  industryEngineId: uuidSchema,
  slug: slugSchema,
  reference: requiredText("Project reference", 100),
  name: requiredText("Project name"),
  description: optionalText(5_000).default(""),
  location: requiredText("Project location", 500),
  currency: currencySchema.default("AED"),
  taxRate: percentage("Tax rate", 100).default("5"),
  language: requiredText("Language", 50).default("English"),
  status: projectStatusSchema.default("DRAFT"),
  currentRevisionNumber: z.number().int().positive().default(1),
}).strict();

export const projectUpdateSchema = projectSchema.partial().omit({ currentRevisionNumber: true });

export const boqSchema = z.object({
  projectId: uuidSchema,
  title: requiredText("BOQ title", 500),
  revisionNumber: z.number().int().positive().default(1),
  status: boqStatusSchema.default("DRAFT"),
  isLocked: z.boolean().default(false),
  lockedAt: dateInputSchema.nullable().optional(),
  approvedByName: nullableText(255),
  discountPercentage: percentage("Discount percentage", 100).default("0"),
  taxRate: percentage("Tax rate", 100).default("5"),
}).strict().superRefine((value, context) => {
  if (value.isLocked && !value.lockedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lockedAt"],
      message: "lockedAt is required when a BOQ is locked.",
    });
  }
});

export const boqUpdateSchema = z.object({
  title: requiredText("BOQ title", 500).optional(),
  status: boqStatusSchema.optional(),
  approvedByName: nullableText(255),
  discountPercentage: percentage("Discount percentage", 100).optional(),
  taxRate: percentage("Tax rate", 100).optional(),
}).strict();

export const boqSectionSchema = z.object({
  boqId: uuidSchema,
  code: requiredText("Section code", 100),
  title: requiredText("Section title", 500),
  description: optionalText(2_000).default(""),
  sortOrder: z.number().int().nonnegative(),
}).strict();

export const boqSectionUpdateSchema = boqSectionSchema.omit({ boqId: true }).partial();

export const boqItemOptionSchema = z.object({
  label: requiredText("Option label", 255),
  description: optionalText(2_000).default(""),
  specification: optionalText(2_000).default(""),
  rate: money("Option rate").default("0"),
  isSelected: z.boolean().default(false),
}).strict();

const boqItemObjectSchema = z.object({
  sectionId: uuidSchema,
  itemNumber: z.number().int().positive(),
  itemCode: requiredText("Item code", 100),
  category: requiredText("Category", 255),
  description: requiredText("Description", 2_000),
  specification: optionalText(5_000).default(""),
  quantity: quantity("Quantity"),
  unit: requiredText("Unit", 50),
  unitCost: money("Unit cost").default("0"),
  freightCost: money("Freight cost").default("0"),
  installationCost: money("Installation cost").default("0"),
  additionalCost: money("Additional cost").default("0"),
  landedCost: money("Landed cost").default("0"),
  marginMode: marginModeSchema.default("MARKUP"),
  marginPercentage: percentage("Margin percentage").default("0"),
  sellingRate: money("Selling rate").default("0"),
  totalAmount: totalMoney("Total amount").default("0"),
  wastagePercentage: percentage("Wastage percentage").default("0"),
  taxApplicable: z.boolean().default(true),
  sourceReference: optionalText(500).default(""),
  roomOrZone: optionalText(500).default(""),
  drawingReference: optionalText(500).default(""),
  confidenceScore: percentage("Confidence score", 100).default("100"),
  status: boqItemStatusSchema.default("DRAFT"),
  notes: optionalText(5_000).default(""),
  sortOrder: z.number().int().nonnegative(),
  options: z.array(boqItemOptionSchema).max(100).optional(),
}).strict();

export const boqItemSchema = boqItemObjectSchema.superRefine((value, context) => {
  if (value.marginMode === "GROSS_MARGIN" && value.marginPercentage.greaterThanOrEqualTo(100)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["marginPercentage"],
      message: "Gross margin percentage must be less than 100.",
    });
  }
});

export const boqItemUpdateSchema = boqItemObjectSchema.omit({ sectionId: true }).partial().superRefine((value, context) => {
  if (value.marginMode === "GROSS_MARGIN" && value.marginPercentage?.greaterThanOrEqualTo(100)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["marginPercentage"],
      message: "Gross margin percentage must be less than 100.",
    });
  }
});

export const rateCatalogueItemSchema = z.object({
  industryEngineId: uuidSchema,
  itemCode: requiredText("Item code", 100),
  category: requiredText("Category", 255),
  description: requiredText("Description", 2_000),
  unit: requiredText("Unit", 50),
  supplier: requiredText("Supplier", 255),
  cost: money("Catalogue cost"),
  defaultMargin: percentage("Default margin").default("0"),
  sellingRate: money("Selling rate"),
  currency: currencySchema.default("AED"),
  effectiveDate: dateInputSchema,
  expiryDate: dateInputSchema.nullable().optional(),
  status: rateStatusSchema.default("ACTIVE"),
}).strict().superRefine((value, context) => {
  if (value.expiryDate && value.expiryDate.getTime() < value.effectiveDate.getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiryDate"],
      message: "Expiry date cannot be before the effective date.",
    });
  }
});

export const rateCatalogueItemUpdateSchema = z.object({
  itemCode: requiredText("Item code", 100).optional(),
  category: requiredText("Category", 255).optional(),
  description: requiredText("Description", 2_000).optional(),
  unit: requiredText("Unit", 50).optional(),
  supplier: requiredText("Supplier", 255).optional(),
  cost: money("Catalogue cost").optional(),
  defaultMargin: percentage("Default margin").optional(),
  sellingRate: money("Selling rate").optional(),
  currency: currencySchema.optional(),
  effectiveDate: dateInputSchema.optional(),
  expiryDate: dateInputSchema.nullable().optional(),
  status: rateStatusSchema.optional(),
}).strict();

export const verificationResolutionSchema = z.object({
  resolutionNote: requiredText("Resolution note", 2_000),
  suggestedValue: nullableText(2_000),
  resolved: z.literal(true).default(true),
}).strict();

export type StructuredValidationFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type StructuredValidationSuccess<T> = { ok: true; data: T };

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  }
  return fieldErrors;
}

export function structuredValidationError(
  error: z.ZodError,
  code = "INVALID_REQUEST",
  message = "Request validation failed.",
): StructuredValidationFailure {
  const fieldErrors = zodFieldErrors(error);
  return {
    ok: false,
    error: {
      code,
      message,
      ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    },
  };
}

export function validateWriteInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): StructuredValidationSuccess<z.output<TSchema>> | StructuredValidationFailure {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : structuredValidationError(result.error);
}

export type CompanyWriteInput = z.input<typeof companySchema>;
export type ClientWriteInput = z.input<typeof clientSchema>;
export type ProjectWriteInput = z.input<typeof projectSchema>;
export type BOQWriteInput = z.input<typeof boqSchema>;
export type BOQSectionWriteInput = z.input<typeof boqSectionSchema>;
export type BOQItemWriteInput = z.input<typeof boqItemSchema>;
export type RateCatalogueItemWriteInput = z.input<typeof rateCatalogueItemSchema>;
export type VerificationResolutionInput = z.input<typeof verificationResolutionSchema>;
