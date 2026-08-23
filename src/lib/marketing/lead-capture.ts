import { createHash } from "node:crypto";
import { z } from "zod";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError } from "@/lib/errors/app-error";

export const MARKETING_LEAD_SHEET_COLUMNS = [
  "Date",
  "Name",
  "Email",
  "Mobile",
  "Company",
  "Industry",
  "Package Interest",
  "Page",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "User ID",
  "Consent",
  "Status",
] as const;

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default("");

export function normalizeMarketingMobile(value: string): string {
  let normalized = value.trim().replace(/[\s().-]/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (/^05\d{8}$/.test(normalized)) normalized = `+971${normalized.slice(1)}`;
  if (/^971\d{7,12}$/.test(normalized)) normalized = `+${normalized}`;
  return normalized;
}

const normalizedMobileSchema = z
  .string()
  .trim()
  .min(1, "WhatsApp / Mobile is required.")
  .max(40)
  .transform(normalizeMarketingMobile)
  .refine(
    (value) => /^\+?[1-9]\d{6,14}$/.test(value),
    "Enter a valid mobile number with a country code when outside the UAE.",
  );

const safePagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(
    (value) =>
      value.startsWith("/")
      && !value.startsWith("//")
      && !value.includes("\\")
      && !value.includes("?")
      && !value.includes("#")
      && !/[\u0000-\u001f\u007f]/.test(value),
    "Page must be a safe site path.",
  );

export const marketingLeadRequestSchema = z
  .object({
    fullName: boundedText(160),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    mobile: normalizedMobileSchema,
    company: optionalText(255),
    industry: boundedText(160),
    packageInterest: optionalText(255),
    page: safePagePathSchema,
    utmSource: optionalText(255),
    utmMedium: optionalText(255),
    utmCampaign: optionalText(255),
    marketingConsent: z.literal(true),
    website: z.literal("").optional().default(""),
  })
  .strict();

export type MarketingLeadRequest = z.infer<typeof marketingLeadRequestSchema>;

export type MarketingLeadRecord = {
  submittedAt: string;
  fullName: string;
  email: string;
  mobile: string;
  company: string;
  industry: string;
  packageInterest: string;
  page: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  userId: string;
  marketingConsent: true;
  status: "NEW";
};

export type MarketingLeadSheetRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  true,
  "NEW",
];

export function buildMarketingLeadRecord(
  input: MarketingLeadRequest,
  actor: CurrentActor | null,
  submittedAt = new Date(),
): MarketingLeadRecord {
  return {
    submittedAt: submittedAt.toISOString(),
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile,
    company: input.company,
    industry: input.industry,
    packageInterest: input.packageInterest,
    page: input.page,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    userId: actor?.userId ?? "",
    marketingConsent: true,
    status: "NEW",
  };
}

export function buildMarketingLeadSheetRow(lead: MarketingLeadRecord): MarketingLeadSheetRow {
  return [
    lead.submittedAt,
    lead.fullName,
    lead.email,
    lead.mobile,
    lead.company,
    lead.industry,
    lead.packageInterest,
    lead.page,
    lead.utmSource,
    lead.utmMedium,
    lead.utmCampaign,
    lead.userId,
    lead.marketingConsent,
    lead.status,
  ];
}

export function marketingLeadFingerprint(lead: MarketingLeadRecord): string {
  return createHash("sha256")
    .update([lead.email, lead.mobile, lead.packageInterest, lead.page].join("\u0000"))
    .digest("hex");
}

type RapidSubmissionClaim = {
  complete(): void;
  release(): void;
};

export function createRapidLeadSubmissionGuard(options: {
  windowMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const pending = new Set<string>();
  const recentSuccesses = new Map<string, number>();

  function prune(timestamp: number) {
    for (const [key, expiresAt] of recentSuccesses) {
      if (expiresAt <= timestamp) recentSuccesses.delete(key);
    }
  }

  return {
    begin(key: string): RapidSubmissionClaim {
      const timestamp = now();
      prune(timestamp);
      if (pending.has(key) || (recentSuccesses.get(key) ?? 0) > timestamp) {
        throw new AppError(
          "DUPLICATE_LEAD_SUBMISSION",
          "This request was already received. Please wait before submitting it again.",
          409,
        );
      }

      pending.add(key);
      let settled = false;

      return {
        complete() {
          if (settled) return;
          settled = true;
          pending.delete(key);
          recentSuccesses.set(key, now() + options.windowMs);
        },
        release() {
          if (settled) return;
          settled = true;
          pending.delete(key);
        },
      };
    },
  };
}
