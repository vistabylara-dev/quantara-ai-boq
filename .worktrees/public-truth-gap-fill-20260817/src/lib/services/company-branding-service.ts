import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getBranding, upsertBranding, type BrandingUpdateInput } from "@/lib/repositories/company-branding-repository";
import { isValidCoverStyle, isValidHexColor, isValidLogoPosition, sanitizeEmailSignatureHtml } from "@/lib/branding/sanitize-html";

export async function getBrandingForCompany(actor: CurrentActor) {
  return getBranding(actor.companyId);
}

const COLOR_FIELDS = ["primaryColor", "secondaryColor", "accentColor", "documentHeaderColor", "tableHeaderColor"] as const;

/**
 * Validates colours and cover/logo enums, sanitizes the one free-form HTML
 * field (email signature) — branding affects generated company documents
 * but must never be able to inject arbitrary CSS/script into the app's own
 * UI (spec Phase 7 section 9).
 */
export async function updateBrandingForCompany(actor: CurrentActor, input: BrandingUpdateInput) {
  requireCapability(actor, "company:manage");

  for (const field of COLOR_FIELDS) {
    const value = input[field];
    if (value !== undefined && !isValidHexColor(value)) {
      throw new AppError("INVALID_BRAND_COLOR", `${field} must be a valid hex color (e.g. #0F172A).`, 400, { [field]: [`${field} must be a valid hex color.`] });
    }
  }
  if (input.coverStyle !== undefined && !isValidCoverStyle(input.coverStyle)) {
    throw new AppError("INVALID_COVER_STYLE", "coverStyle must be 'light' or 'dark'.", 400);
  }
  if (input.logoPosition !== undefined && !isValidLogoPosition(input.logoPosition)) {
    throw new AppError("INVALID_LOGO_POSITION", "logoPosition must be 'top-left', 'top-center', or 'top-right'.", 400);
  }

  const sanitized: BrandingUpdateInput = {
    ...input,
    ...(input.emailSignatureHtml !== undefined ? { emailSignatureHtml: sanitizeEmailSignatureHtml(input.emailSignatureHtml) } : {}),
  };

  const branding = await upsertBranding(actor.companyId, sanitized);
  await createAuditLog(actor.companyId, { entityType: "CompanyBranding", entityId: branding.id, action: "BRANDING_UPDATED" });
  return branding;
}
