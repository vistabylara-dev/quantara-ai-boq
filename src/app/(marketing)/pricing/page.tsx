import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { buildRegisterPricingHref, type TrustedPublicPriceCode } from "@/lib/commercial/pricing-intent";
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

  /**
   * CORRECTION-1 mission 4 — Enterprise added to the public pricing journey
   * (previously only Starter/Professional/Business were visible here, so a
   * visitor arriving from an ad had no way to even discover Enterprise
   * exists), but deliberately WITHOUT the specific per-tier annual AED
   * amounts (the ones approved for Phase A / shown on the authenticated
   * settings page): tests/public-product-truth.test.ts's "does not publish
   * unverified self-serve prices" assertions encode this repo's existing
   * product-truth policy that the
   * `enterprise-feature-bundle` capability — status NOT_AVAILABLE in
   * src/lib/public-site/product-truth.ts — must never show a specific price
   * on the public site. That policy predates this change and is a real,
   * intentional guardrail, not an oversight; showing exact figures here
   * would silently violate it. Every card routes to /contact-sales rather
   * than any self-service checkout intent, matching the public Terms
   * (legal.terms.checkoutBody: Enterprise scope requires a separate written
   * quotation) and the same sales-led CTA used on the authenticated
   * /settings/subscription Enterprise section — the AUTHENTICATED settings
   * page is still the right place to show the approved AED amounts to a
   * signed-in company evaluating an upgrade.
   */
  const enterprisePlans: { key: string; name: string; priceCode: TrustedPublicPriceCode; price: string; features: string[] }[] = [
    {
      key: "enterprise_core",
      name: t("publicContent.pricing.saasEnterpriseCoreName"),
      priceCode: "enterprise_core_annual_aed_15000",
      price: "AED 15,000",
      features: [
        t("publicContent.pricing.saasEnterpriseCoreFeature1"),
        t("publicContent.pricing.saasEnterpriseCoreFeature2"),
        t("publicContent.pricing.saasEnterpriseCoreFeature3"),
        t("publicContent.pricing.saasEnterpriseCoreFeature4"),
      ],
    },
    {
      key: "enterprise_scale",
      name: t("publicContent.pricing.saasEnterpriseScaleName"),
      priceCode: "enterprise_scale_annual_aed_25000",
      price: "AED 25,000",
      features: [
        t("publicContent.pricing.saasEnterpriseScaleFeature1"),
        t("publicContent.pricing.saasEnterpriseScaleFeature2"),
        t("publicContent.pricing.saasEnterpriseScaleFeature3"),
        t("publicContent.pricing.saasEnterpriseScaleFeature4"),
      ],
    },
    {
      key: "enterprise_authority",
      name: t("publicContent.pricing.saasEnterpriseAuthorityName"),
      priceCode: "enterprise_authority_annual_aed_35000",
      price: "AED 35,000",
      features: [
        t("publicContent.pricing.saasEnterpriseAuthorityFeature1"),
        t("publicContent.pricing.saasEnterpriseAuthorityFeature2"),
        t("publicContent.pricing.saasEnterpriseAuthorityFeature3"),
        t("publicContent.pricing.saasEnterpriseAuthorityFeature4"),
      ],
    },
  ];

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

          <section className="mx-auto mt-24 max-w-6xl border-t border-slate-800 pt-16" aria-labelledby="enterprise-pricing-heading">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                {t("publicContent.pricing.saasEnterpriseEyebrow")}
              </p>
              <h2 id="enterprise-pricing-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t("publicContent.pricing.saasEnterpriseTitle")}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-300">
                {t("publicContent.pricing.saasEnterpriseBody")}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {enterprisePlans.map((plan) => (
                <article key={plan.key} className="rounded-3xl border border-amber-400/20 bg-slate-950 p-7">
                  <div className="mb-5">
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                  </div>
                  <div className="mt-2">
                    <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-sm font-semibold text-slate-400"> /{billingLabels.perYear}</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                        <span dir="auto">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={buildRegisterPricingHref(plan.priceCode)}
                    className="mt-7 flex h-11 items-center justify-center rounded-lg bg-amber-400 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    {t("publicContent.pricing.saasEnterpriseSelect")} {plan.name}
                  </Link>
                </article>
              ))}
            </div>
          </section>

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
