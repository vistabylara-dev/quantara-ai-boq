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
    expect(verifyPage).toContain('trackFirstConversionEvent("email_verified"');
    expect(english).not.toContain("development console link");
  });

  it("opens drawing intake after project creation and marks BOQ preparation only when ready", () => {
    const newProjectPage = source("src/app/projects/new/page.tsx");
    const drawingsPage = source("src/app/projects/[projectId]/drawings/page.tsx");
    const industriesRoute = source("src/app/api/industries/route.ts");

    expect(newProjectPage).toContain('emitOnboardingActionComplete("PROJECT_CREATED"');
    expect(newProjectPage).not.toContain('emitOnboardingActionComplete("BOQ_PREPARED"');
    expect(drawingsPage).toContain('emitOnboardingActionComplete("BOQ_PREPARED"');
    expect(newProjectPage).toContain('trackFirstConversionEvent("first_project_created"');
    expect(newProjectPage).not.toContain('trackFirstConversionEvent("first_boq_created"');
    expect(newProjectPage).toContain("/drawings`");
    expect(newProjectPage).not.toContain("router.push(`/projects/${result.project.id}`)");
    expect(industriesRoute).toContain("ensureCompanyIndustryEngines(actor.companyId)");
  });

  it("routes new project clients through the complete client record form", () => {
    const clientPicker = source("src/components/projects/client-picker.tsx");
    const clientForm = source("src/components/clients/client-form.tsx");
    const clientRepository = source("src/lib/repositories/client-repository.ts");

    expect(clientPicker).not.toContain('apiClient.post<Client>("/api/clients", { name: quickCreateName })');
    expect(clientPicker).toContain("initialName={quickCreateName}");
    expect(clientForm).toContain('apiClient.post<Client>("/api/clients", values)');
    expect(clientForm).toContain('const FormContainer = compact ? "div" : "form"');
    expect(clientForm).toContain('type={compact ? "button" : "submit"}');
    expect(clientForm).toContain("companyName");
    expect(clientForm).toContain("taxRegistrationNumber");
    expect(clientPicker).toContain("setResults((current) => [client, ...current.filter");
    expect(clientPicker).toContain("loadError");
    expect(clientPicker).toContain("loadClients(search)");
    expect(clientRepository).toContain('orderBy: [{ updatedAt: "desc" }, { id: "asc" }]');
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
    const loginPage = source("src/app/login/page.tsx");
    const resendRoute = source("src/app/api/auth/resend-verification/route.ts");
    const authService = source("src/lib/services/auth-service.ts");

    expect(registerPage).toContain("emailDeliveryStatus");
    expect(registerPage).toContain("/api/auth/resend-verification");
    expect(loginPage).toContain('submitError.code === "EMAIL_NOT_VERIFIED"');
    expect(loginPage).toContain("/api/auth/resend-verification");
    expect(loginPage).toContain("auth.login.resendVerification");
    expect(resendRoute).toContain("resendEmailLimiter");
    expect(authService).toContain("resendEmailVerification");
    expect(authService).toContain("emailVerificationToken.deleteMany");
  });
});
