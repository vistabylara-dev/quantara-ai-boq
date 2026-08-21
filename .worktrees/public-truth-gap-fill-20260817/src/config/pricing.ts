import type { TranslateFn } from "@/lib/i18n/translate";

export function getPublicAccessOptions(t: TranslateFn) {
  return [
    {
      key: "ACCOUNT_ONBOARDING",
      name: t("publicContent.pricing.accountName"),
      commercialTerms: t("publicContent.pricing.accountTerms"),
      description: t("publicContent.pricing.accountDescription"),
      features: [
        t("publicContent.pricing.accountFeatureFormats"),
        t("publicContent.pricing.accountFeatureReview"),
        t("publicContent.pricing.accountFeatureProfessional"),
        t("publicContent.pricing.accountFeatureControlled"),
      ],
      href: "/register",
      ctaLabel: t("publicContent.cta.startAccountSetup"),
      featured: true,
    },
    {
      key: "ENTERPRISE_REVIEW",
      name: t("publicContent.pricing.enterpriseName"),
      commercialTerms: t("publicContent.pricing.enterpriseTerms"),
      description: t("publicContent.pricing.enterpriseDescription"),
      features: [
        t("publicContent.pricing.enterpriseFeatureWorkflow"),
        t("publicContent.pricing.enterpriseFeatureConfiguration"),
        t("publicContent.pricing.enterpriseFeatureScope"),
        t("publicContent.pricing.enterpriseFeatureWritten"),
      ],
      href: "/contact-sales",
      ctaLabel: t("publicContent.pricing.discussRequirements"),
      featured: false,
    },
  ] as const;
}

export type PublicAccessOption = ReturnType<typeof getPublicAccessOptions>[number];
