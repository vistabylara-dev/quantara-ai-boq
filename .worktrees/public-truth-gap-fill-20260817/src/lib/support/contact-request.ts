import { z } from "zod";
import type { CurrentActor } from "@/lib/auth/current-actor";

export const SUPPORT_REQUEST_TYPES = ["FEATURE", "PROBLEM", "HELP", "SALES"] as const;
export const SUPPORT_SURFACES = ["PUBLIC", "SAAS"] as const;
export const SUPPORT_LOCALES = ["en", "ar"] as const;

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default("");

const safeRouteSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("?") &&
      !value.includes("#") &&
      !/[\u0000-\u001f\u007f]/.test(value),
    "The current route must be a pathname without a query or fragment.",
  );

const requestContextSchema = z
  .object({
    currentRoute: safeRouteSchema,
    surface: z.enum(SUPPORT_SURFACES),
    locale: z.enum(SUPPORT_LOCALES),
  })
  .strict();

export const supportContactRequestSchema = z
  .object({
    kind: z.literal("SUPPORT"),
    requestType: z.enum(SUPPORT_REQUEST_TYPES),
    title: boundedText(160),
    description: boundedText(4_000),
    goal: boundedText(2_000),
    email: z.string().trim().email().max(254),
    company: optionalText(255),
    consent: z.literal(true),
    context: requestContextSchema,
    website: z.literal("").optional().default(""),
  })
  .strict();

export const salesContactRequestSchema = z
  .object({
    kind: z.literal("SALES"),
    fullName: boundedText(160),
    businessEmail: z.string().trim().email().max(254),
    companyName: boundedText(255),
    country: boundedText(120),
    role: boundedText(160),
    companyType: boundedText(160),
    constructionDiscipline: boundedText(160),
    monthlyVolume: boundedText(120),
    currentBoqProcess: boundedText(1_000),
    requiredInputs: boundedText(1_000),
    requiredOutputs: boundedText(1_000),
    numberOfUsers: boundedText(120),
    preferredContactMethod: z.enum(["Email", "Phone", "WhatsApp"]),
    message: boundedText(4_000),
    consent: z.literal(true),
    website: z.literal("").optional().default(""),
  })
  .strict();

export const contactRequestSchema = z.discriminatedUnion("kind", [
  supportContactRequestSchema,
  salesContactRequestSchema,
]);

export type SupportContactRequest = z.infer<typeof supportContactRequestSchema>;
export type SalesContactRequest = z.infer<typeof salesContactRequestSchema>;
export type ContactRequest = z.infer<typeof contactRequestSchema>;

export type SalesInquiryWrite = {
  firstName: string;
  lastName: string;
  workEmail: string;
  companySize: string;
  useCase: string;
  companyType: string | null;
  constructionDiscipline: string | null;
  currentBoqProcess: string | null;
  monthlyVolume: string | null;
  requiredInputs: string | null;
  requiredOutputs: string | null;
  numberOfUsers: string | null;
  integrationRequirements: string | null;
  preferredContactMethod: string | null;
  consent: true;
  deliveryStatus: "stored";
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Requester" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function buildSalesInquiryWrite(
  request: ContactRequest,
  actor: CurrentActor | null,
  submittedAt = new Date(),
): SalesInquiryWrite {
  if (request.kind === "SALES") {
    const name = splitName(request.fullName);
    return {
      ...name,
      workEmail: request.businessEmail,
      companySize: request.numberOfUsers,
      useCase: request.message,
      companyType: request.companyType,
      constructionDiscipline: request.constructionDiscipline,
      currentBoqProcess: request.currentBoqProcess,
      monthlyVolume: request.monthlyVolume,
      requiredInputs: request.requiredInputs,
      requiredOutputs: request.requiredOutputs,
      numberOfUsers: request.numberOfUsers,
      integrationRequirements: JSON.stringify({
        kind: "SALES",
        companyName: request.companyName,
        country: request.country,
        role: request.role,
        message: request.message,
      }),
      preferredContactMethod: request.preferredContactMethod,
      consent: true,
      deliveryStatus: "stored",
    };
  }

  const name = actor ? splitName(actor.fullName) : { firstName: "Support", lastName: "Requester" };
  return {
    ...name,
    workEmail: request.email,
    companySize: request.company || "Not provided",
    useCase: `[${request.requestType}] ${request.title}`,
    companyType: null,
    constructionDiscipline: null,
    currentBoqProcess: null,
    monthlyVolume: null,
    requiredInputs: null,
    requiredOutputs: null,
    numberOfUsers: null,
    integrationRequirements: JSON.stringify({
      kind: "SUPPORT",
      description: request.description,
      goal: request.goal,
      company: request.company || null,
      context: {
        currentRoute: request.context.currentRoute,
        surface: request.context.surface,
        locale: request.context.locale,
        submittedAt: submittedAt.toISOString(),
        userId: actor?.userId ?? null,
        companyId: actor?.companyId ?? null,
      },
    }),
    preferredContactMethod: "Email",
    consent: true,
    deliveryStatus: "stored",
  };
}
