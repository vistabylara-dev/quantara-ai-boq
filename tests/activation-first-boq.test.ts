import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/lib/validation/auth-schemas";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("first-value activation journey", () => {
  it("accepts only governed public plan codes during registration", () => {
    const base = {
      companyName: "Activation Company",
      fullName: "Test Owner",
      email: "owner@example.com",
      password: "Password123",
    };

    expect(registerSchema.safeParse({
      ...base,
      priceCode: "starter_monthly_aed_149",
    }).success).toBe(true);
    expect(registerSchema.safeParse({
      ...base,
      priceCode: "price_untrusted_provider_identifier",
    }).success).toBe(false);
  });

  it("uses production verification guidance and preserves plan continuation", () => {
    const verifyPage = source("src/app/verify-email/page.tsx");
    const english = source("src/lib/i18n/dictionaries/en.ts");

    expect(verifyPage).toContain("normalizePublicPriceCode");
    expect(verifyPage).toContain("buildLoginPricingHref");
    expect(verifyPage).toContain('trackConversionEvent("email_verified"');
    expect(english).not.toContain("development console link");
  });

  it("opens the automatically created BOQ immediately after project creation", () => {
    const newProjectPage = source("src/app/projects/new/page.tsx");

    expect(newProjectPage).toContain('emitOnboardingActionComplete("PROJECT_CREATED"');
    expect(newProjectPage).toContain('emitOnboardingActionComplete("BOQ_PREPARED"');
    expect(newProjectPage).toContain("/boq`");
    expect(newProjectPage).not.toContain("router.push(`/projects/${result.project.id}`)");
  });

  it("offers one-action client creation inside the project picker", () => {
    const clientPicker = source("src/components/projects/client-picker.tsx");

    expect(clientPicker).toContain('apiClient.post<Client>("/api/clients", { name: quickCreateName })');
    expect(clientPicker).toContain("projects.clientPicker.quickCreate");
  });

  it("records first export only after successful BOQ document generation", () => {
    const documentsPage = source("src/app/projects/[projectId]/documents/page.tsx");
    const previewPage = source("src/app/projects/[projectId]/documents/preview/page.tsx");
    const tayqanPanel = source("src/components/tayqan/tayqan-work-order-panel.tsx");

    for (const exportSurface of [documentsPage, previewPage, tayqanPanel]) {
      expect(exportSurface).toContain('trackFirstConversionEvent("first_export_generated"');
      expect(exportSurface.indexOf('trackFirstConversionEvent("first_export_generated"'))
        .toBeGreaterThan(exportSurface.indexOf("apiClient.post"));
    }
  });

  it("does not strand an account when verification delivery fails", () => {
    const registerPage = source("src/app/(marketing)/register/page.tsx");
    const resendRoute = source("src/app/api/auth/resend-verification/route.ts");
    const authService = source("src/lib/services/auth-service.ts");

    expect(registerPage).toContain("emailDeliveryStatus");
    expect(registerPage).toContain("/api/auth/resend-verification");
    expect(resendRoute).toContain("resendEmailLimiter");
    expect(authService).toContain("resendEmailVerification");
    expect(authService).toContain("emailVerificationToken.deleteMany");
  });
});
