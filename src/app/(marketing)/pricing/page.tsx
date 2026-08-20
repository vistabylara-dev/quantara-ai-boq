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
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";
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
  const sales = getPublicSalesTruth(locale);
  const comparisonCopy = locale === "ar"
    ? {
        title: "قارن ملاءمة سير العمل قبل الشراء",
        body: "استخدم دليل المشتري القائم على الأدلة في الإمارات لمقارنة المدخلات المطلوبة والقياس وضوابط المراجعة والمخرجات وأسئلة المشتريات الإقليمية قبل اختيار المنصة.",
        cta: "افتح مقارنة برامج جداول الكميات",
      }
    : {
        title: "Compare Workflow Fit Before Purchase",
        body: "Use the evidence-led UAE buyer guide to compare required inputs, takeoff, review controls, outputs and regional procurement questions before selecting a platform.",
        cta: "Open the BOQ software comparison",
      };

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
      <div className="bg-[#030508] py-24 sm:py-32">
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

          <section className="mx-auto mt-24 max-w-6xl border-t border-slate-800 pt-16" aria-labelledby="tayqan-pricing-heading">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                {sales.tayqanPricingEyebrow}
              </p>
              <h2 id="tayqan-pricing-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {sales.tayqanPricingTitle}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-300">
                {sales.tayqanPricingBody}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {TAYQAN_HIRE_PLANS.map((plan) => {
                const copy = sales.tayqanPlans[plan.plan];
                const amount = `AED ${(plan.amountMinor / 100).toLocaleString("en-AE")}`;
                const cadence = plan.billingInterval === "MONTH" ? sales.perMonth : sales.oneTime;

                return (
                  <article
                    key={plan.plan}
                    className={`rounded-3xl border bg-slate-950 p-7 ${
                      plan.plan === "WEEK" ? "border-cyan-500/70 shadow-lg shadow-cyan-950/20" : "border-slate-800"
                    }`}
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                        {copy.badge}
                      </span>
                      <span className="text-sm text-slate-400">{copy.duration}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white">{copy.title}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-relaxed text-slate-400">{copy.bestFor}</p>
                    <div className="mt-6">
                      <span className="text-4xl font-extrabold text-white">{amount}</span>
                      <span className="ms-2 text-sm text-slate-400">{cadence}</span>
                    </div>
                    {plan.maxDistinctProjects ? (
                      <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                        {sales.upToProjects.replace("{count}", String(plan.maxDistinctProjects))}
                      </p>
                    ) : null}
                    <p className="mt-5 text-sm leading-relaxed text-slate-400">
                      {sales.professionalAcceptance}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-6 font-semibold text-white hover:bg-cyan-800"
              >
                {sales.tayqanAccountCta}
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold text-white hover:bg-slate-900"
              >
                {sales.tayqanExistingAccountCta}
              </Link>
            </div>
          </section>

          <aside className="mx-auto mt-12 max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
            <h2 className="text-xl font-bold text-white">{comparisonCopy.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              {comparisonCopy.body}
            </p>
            <Link href="/boq-software-comparison-uae" className="mt-5 inline-flex font-semibold text-blue-300 hover:text-blue-200">
              {comparisonCopy.cta} <span aria-hidden="true" className="ms-2 inline-block rtl:rotate-180">&rarr;</span>
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
