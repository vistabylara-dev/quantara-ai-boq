import { describe, expect, it } from "vitest";
import { toCompanyProfileUpdate, type CompanyProfileUpdate } from "../src/lib/company-profile-update";

describe("company profile update payload", () => {
  it("omits read-only fields returned by the company API", () => {
    const profile: CompanyProfileUpdate & Record<string, unknown> = {
      legalName: "Quantara Platform Administration",
      tradeName: "Quantara Platform Administration",
      email: "platform@quantara.internal",
      phone: null,
      website: null,
      address: "Dubai",
      country: null,
      taxRegistrationNumber: null,
      defaultCurrency: "AED",
      vatRate: 5,
      defaultLanguage: "English",
      logoUrl: null,
      authorizedSignatoryName: null,
      authorizedSignatoryTitle: null,
      stampUrl: null,
      signatureUrl: null,
      defaultTerms: null,
      defaultExclusions: null,
      defaultValidityDays: 30,
      id: "company-id",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
      isTestCompany: true,
    };

    const payload = toCompanyProfileUpdate(profile);

    expect(payload.address).toBe("Dubai");
    expect(payload.taxRegistrationNumber).toBeNull();
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
    expect(payload).not.toHaveProperty("isTestCompany");
  });
});
