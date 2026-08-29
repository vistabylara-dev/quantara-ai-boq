export type CompanyProfileUpdate = {
  legalName: string;
  tradeName: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  taxRegistrationNumber: string | null;
  defaultCurrency: string;
  vatRate: number;
  defaultLanguage: string;
  logoUrl: string | null;
  authorizedSignatoryName: string | null;
  authorizedSignatoryTitle: string | null;
  stampUrl: string | null;
  signatureUrl: string | null;
  defaultTerms: string | null;
  defaultExclusions: string | null;
  defaultValidityDays: number;
};

export function toCompanyProfileUpdate(profile: CompanyProfileUpdate & Record<string, unknown>): CompanyProfileUpdate {
  return {
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    email: profile.email,
    phone: profile.phone,
    website: profile.website,
    address: profile.address,
    country: profile.country,
    taxRegistrationNumber: profile.taxRegistrationNumber,
    defaultCurrency: profile.defaultCurrency,
    vatRate: profile.vatRate,
    defaultLanguage: profile.defaultLanguage,
    logoUrl: profile.logoUrl,
    authorizedSignatoryName: profile.authorizedSignatoryName,
    authorizedSignatoryTitle: profile.authorizedSignatoryTitle,
    stampUrl: profile.stampUrl,
    signatureUrl: profile.signatureUrl,
    defaultTerms: profile.defaultTerms,
    defaultExclusions: profile.defaultExclusions,
    defaultValidityDays: profile.defaultValidityDays,
  };
}
