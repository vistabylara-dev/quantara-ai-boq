import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import PricingPlans, { type PricingPlan } from "./pricing-plans";

export const metadata = createPublicPageMetadata("/pricing");

const searchEntry = getPublicSearchPage("/pricing");
const pageSchema = buildPublicPageGraph({
  path: "/pricing",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "Pricing", path: "/pricing" },
  ],
});

export default async function PricingPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));

  const plans: PricingPlan[] = [
    {
      key: "starter",
      name: t("publicContent.pricing.saasStarterName"),
      recommended: false,
      ctaLabel: t("publicContent.pricing.saasStarterCta"),
      features: [
        t("publicContent.pricing.saasStarterFeature1"),
        t("publicContent.pricing.saasStarterFeature2"),
        t("publicContent.pricing.saasStarterFeature3"),
        t("publicContent.pricing.saasStarterFeature4"),
        t("publicContent.pricing.saasStarterFeature5"),
        t("publicContent.pricing.saasStarterFeature6"),
        t("publicContent.pricing.saasStarterFeature7"),
      ],
      monthly: { amount: "AED 149", priceCode: "starter_monthly_aed_149" },
      annual: { amount: "AED 1,490", priceCode: "starter_annual_aed_1490" },
    },
    {
      key: "professional",
      name: t("publicContent.pricing.saasProfessionalName"),
      recommended: true,
      ctaLabel: t("publicContent.pricing.saasProfessionalCta"),
      features: [
        t("publicContent.pricing.saasProfessionalFeature1"),
        t("publicContent.pricing.saasProfessionalFeature2"),
        t("publicContent.pricing.saasProfessionalFeature3"),
        t("publicContent.pricing.saasProfessionalFeature4"),
        t("publicContent.pricing.saasProfessionalFeature5"),
        t("publicContent.pricing.saasProfessionalFeature6"),
        t("publicContent.pricing.saasProfessionalFeature7"),
        t("publicContent.pricing.saasProfessionalFeature8"),
      ],
      monthly: { amount: "AED 399", priceCode: "professional_monthly_aed_399" },
      annual: { amount: "AED 3,990", priceCode: "professional_annual_aed_3990" },
    },
    {
      key: "business",
      name: t("publicContent.pricing.saasBusinessName"),
      recommended: false,
      ctaLabel: t("publicContent.pricing.saasBusinessCta"),
      features: [
        t("publicContent.pricing.saasBusinessFeature1"),
        t("publicContent.pricing.saasBusinessFeature2"),
        t("publicContent.pricing.saasBusinessFeature3"),
        t("publicContent.pricing.saasBusinessFeature4"),
        t("publicContent.pricing.saasBusinessFeature5"),
        t("publicContent.pricing.saasBusinessFeature6"),
        t("publicContent.pricing.saasBusinessFeature7"),
        t("publicContent.pricing.saasBusinessFeature8"),
        t("publicContent.pricing.saasBusinessFeature9"),
      ],
      monthly: { amount: "AED 899", priceCode: "business_monthly_aed_899" },
      annual: { amount: "AED 8,990", priceCode: "business_annual_aed_8990" },
    },
  ];

  const billingLabels = {
    monthly: t("publicContent.pricing.saasBillingMonthly"),
    annual: t("publicContent.pricing.saasBillingAnnual"),
    perMonth: t("publicContent.pricing.saasPerMonth"),
    perYear: t("publicContent.pricing.saasPerYear"),
    recommended: t("publicContent.pricing.saasRecommended"),
  };

  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="bg-slate-50 dark:bg-slate-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">

          <nav className="mb-12 text-sm" aria-label={t("publicContent.navigation.breadcrumb")}>
            <ol className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/" className="transition-colors hover:text-slate-900 dark:hover:text-white">{t("publicLanding.home")}</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-slate-900 dark:text-white" aria-current="page">{t("publicContent.pricing.breadcrumb")}</li>
            </ol>
          </nav>

          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              {t("publicContent.pricing.pageTitle")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              {t("publicContent.pricing.hero")}
            </p>
          </div>

          <PricingPlans plans={plans} labels={billingLabels} />
        </div>
      </div>
    </>
  );
}
