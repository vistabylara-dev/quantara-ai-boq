import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import type { TrustedPublicPriceCode } from "@/lib/commercial/pricing-intent";
import React from "react";
import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";
import { CATALOGUE_LIBRARIES } from "@/config/libraries";
import { MARKETPLACE_CONTENT } from "@/config/marketplace-content";
import PricingPlans, { type PricingPlan } from "./pricing-plans";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/pricing", locale);
}

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

/**
 * Public display values only. These owner-approved recurring prices mirror the
 * registered Industry Library catalogue, but deliberately carry no checkout
 * price code. Library checkout remains inside the authenticated Marketplace.
 */
const PUBLIC_LIBRARY_PRICES = {
  hvac: { monthly: "AED 250", annual: "AED 2,500", referenceItems: "891" },
  plumbing: { monthly: "AED 130", annual: "AED 1,300", referenceItems: "13,111" },
  "civil-works": { monthly: "AED 200", annual: "AED 2,000", referenceItems: "3,675" },
  structural: { monthly: "AED 170", annual: "AED 1,700", referenceItems: "9,047" },
  "architectural-finishes": { monthly: "AED 100", annual: "AED 1,000", referenceItems: "80,176" },
  "doors-and-windows": { monthly: "AED 120", annual: "AED 1,200", referenceItems: "11,567" },
  facade: { monthly: "AED 180", annual: "AED 1,800", referenceItems: "15,786" },
  roofing: { monthly: "AED 90", annual: "AED 900", referenceItems: "4,162" },
  "site-infrastructure": { monthly: "AED 160", annual: "AED 1,600", referenceItems: "4,345" },
  landscaping: { monthly: "AED 110", annual: "AED 1,100", referenceItems: "2,867" },
  "general-requirements": { monthly: "AED 80", annual: "AED 800", referenceItems: "4,065" },
  "temporary-works": { monthly: "AED 70", annual: "AED 700", referenceItems: "7,954" },
  closeout: { monthly: "AED 50", annual: "AED 500", referenceItems: "9,452" },
  "bim-and-digital-deliverables": { monthly: "AED 150", annual: "AED 1,500", referenceItems: "4,718" },
  "uae-authority-and-regulatory": { monthly: "AED 90", annual: "AED 900", referenceItems: "11,681" },
} as const;

type PublicLibraryKey = keyof typeof PUBLIC_LIBRARY_PRICES;
type PublicLibraryDetail = {
  bestFor: string;
  usefulFor: string;
  value?: string;
  important?: string;
  disclaimer?: string;
};

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

  const packageCopy = locale === "ar"
    ? {
        overviewEyebrow: "دليل الأسعار الكامل",
        overviewTitle: "اختر بيئة Quantara المناسبة لعملك",
        overviewBody: "قارن برنامج Quantara وخطط Enterprise وخيارات TAYQAN ومكتبات التخصص في صفحة عامة واحدة.",
        layers: [
          "اشتراك Quantara يوفر البرنامج الأساسي.",
          "تضيف مكتبات التخصص محتوى إنشائياً مرجعياً قابلاً لإعادة الاستخدام.",
          "توسع خطط Enterprise استخدام Quantara عبر الشركة.",
          "يوفر TAYQAN قدرة منفصلة لمسّاح كميات رقمي.",
        ],
        software: "خطط البرنامج",
        enterprise: "تركيب Enterprise للشركات",
        tayqan: "خيارات TAYQAN",
        libraries: "مكتبات التخصص",
        planGuideTitle: "ما الخطة المناسبة لفريقك؟",
        planGuideBody: "راجع الجمهور المناسب والغرض التشغيلي لكل خطة قبل اختيار دورة الفوترة.",
        bestFor: "الأنسب لـ",
        purpose: "الغرض",
        whyChoose: "لماذا تختارها",
        fullDetails: "عرض تفاصيل الحزمة كاملة",
        includedScope: "النطاق المشمول",
        planMessage: "ملاحظة الخطة",
        enterpriseEyebrow: "تركيب Enterprise داخل الشركة",
        enterpriseTitle: "حزم Enterprise بدفعة واحدة",
        enterpriseBody: "تغطي كل حزمة تركيب Quantara وتهيئته لبيئة شركتك وفق نطاق تنفيذ متفق عليه. هذه ليست رسوماً شهرية أو سنوية.",
        oneTimePayment: "دفعة واحدة",
        installationIncluded: "تركيب وتهيئة البرنامج للشركة",
        supportIncluded: "دعم عبر الإنترنت أو المحادثة على مدار 24 ساعة",
        enterpriseCta: "اطلب تركيب Quantara لشركتك",
        libraryEyebrow: "محتوى إنشائي متخصص",
        libraryTitle: "أسعار جميع مكتبات التخصص",
        libraryBody: "أضف فقط المكتبات التي تناسب تخصصات شركتك. هذه المكتبات منفصلة عن خطة البرنامج الأساسية.",
        monthlyAccess: "شهرياً",
        annualAccess: "سنوياً",
        registeredDataset: "مجموعة المصدر المسجلة",
        referenceItems: "عنصر مرجعي للكتالوج",
        usefulFor: "مفيدة لـ",
        whyAdd: "القيمة العملية",
        availability: "الأعداد المعروضة تخص مجموعات المصدر المسجلة. يعتمد توفر المحتوى داخل الحساب على تفعيل الحزمة والاستحقاق.",
        activationTitle: "ماذا يحدث بعد تفعيل المكتبة؟",
        contactLibraries: "ناقش وصول المكتبات مع المبيعات",
        existingCustomer: "عميل حالي؟ سجّل الدخول",
        checkoutTitle: "كيف يعمل الدفع الآمن؟",
        checkoutBody: "تعرض هذه الصفحة الأسعار العامة. تبدأ خطط البرنامج بإنشاء حساب أو تسجيل الدخول، ثم ينتقل العميل المؤهل إلى جلسة دفع Stripe آمنة عندما يكون السعر وربط مزود الدفع نشطين ومتزامنين. أما حزم Enterprise فهي دفعة واحدة لتركيب البرنامج للشركة، ويؤكد نطاق التنفيذ كتابياً مع فريق المبيعات قبل الدفع والتركيب. لا يتوفر دفع مجهول.",
      }
    : {
        overviewEyebrow: "Complete pricing guide",
        overviewTitle: "Choose the Quantara environment your business needs",
        overviewBody: "Compare Quantara software, Enterprise plans, TAYQAN capacity and specialist Industry Libraries on one public page.",
        layers: MARKETPLACE_CONTENT.intro.explanation,
        software: "Software plans",
        enterprise: "Enterprise installation",
        tayqan: "TAYQAN options",
        libraries: "Industry Libraries",
        planGuideTitle: "Which software plan fits your team?",
        planGuideBody: "Review who each plan is for, its operating purpose and why a team would choose it before selecting a billing cycle.",
        bestFor: "Best for",
        purpose: "Purpose",
        whyChoose: "Why choose it",
        fullDetails: "View full package details",
        includedScope: "Included scope",
        planMessage: "Plan note",
        enterpriseEyebrow: "Installed for your company",
        enterpriseTitle: "One-time Enterprise installation packages",
        enterpriseBody: "Each package covers Quantara installation and configuration for your company's agreed implementation scope. These are one-time company installation payments, not monthly or annual fees.",
        oneTimePayment: "one-time payment",
        installationIncluded: "Company software installation and configuration",
        supportIncluded: "24-hour online or chat support",
        enterpriseCta: "Request company installation",
        libraryEyebrow: "Specialist construction content",
        libraryTitle: "All Industry Library prices",
        libraryBody: "Add only the specialist libraries that match your company's disciplines. Industry Libraries are separate from the core software plan.",
        monthlyAccess: "per month",
        annualAccess: "per year",
        registeredDataset: "Registered source dataset",
        referenceItems: "catalogue reference items",
        usefulFor: "Useful for",
        whyAdd: "Practical value",
        availability: "Displayed counts describe registered source datasets. In-account content availability depends on package activation and entitlement.",
        activationTitle: MARKETPLACE_CONTENT.libraryPostPurchase.headline,
        contactLibraries: "Discuss library access with sales",
        existingCustomer: "Existing customer? Sign in",
        checkoutTitle: "How does secure payment work?",
        checkoutBody: "This public page shows the published prices. Software-plan buyers create or sign in to an account, and an eligible authenticated customer continues to a secure Stripe Checkout session only when the selected price and provider mapping are active and synchronized. Enterprise packages are one-time company installations: implementation scope is confirmed in writing with sales before payment and installation. Anonymous checkout is not offered.",
      };

  /**
   * Enterprise Core / Scale / Authority are presented here as one-time
   * company-installation packages. Existing annual commerce codes stay as
   * non-operative product metadata in this page-only correction; none is
   * handed to registration or checkout from the Enterprise cards.
   */
  const enterprisePlans: {
    key: keyof typeof MARKETPLACE_CONTENT.enterprise;
    name: string;
    priceCode: TrustedPublicPriceCode;
    price: string;
    features: string[];
  }[] = [
    {
      key: "enterprise_core",
      name: t("publicContent.pricing.saasEnterpriseCoreName"),
      priceCode: "enterprise_core_annual_aed_15000",
      price: "AED 15,000",
      features: locale === "ar"
        ? [
            "تركيب Quantara وتهيئته لبيئة الشركة",
            "بيئة مركزية للمشاريع وجداول الكميات",
            "مكتبة عناصر الشركة ومعايير قابلة لإعادة الاستخدام",
            "إدخال جداول البيانات ومخرجات مهنية خاضعة للمراجعة",
            "إعداد وتشغيل فرق الشركة",
          ]
        : [
            "Quantara installation and configuration for your company",
            "Central project and BOQ environment",
            "Company item library and reusable standards",
            "Structured spreadsheet intake and review-led professional outputs",
            "Company team setup and onboarding",
          ],
    },
    {
      key: "enterprise_scale",
      name: t("publicContent.pricing.saasEnterpriseScaleName"),
      priceCode: "enterprise_scale_annual_aed_25000",
      price: "AED 25,000",
      features: locale === "ar"
        ? [
            "كل ما تتضمنه حزمة Core",
            "تهيئة سير عمل AI Draft BOQ",
            "مراجعة المصادر وإعداد BOQ بمساعدة الذكاء الاصطناعي",
            "سير عمل القياس والحساب الموجّه حيث يكون مدعوماً",
            "وصول مضبوط إلى Google Drive عند الأهلية",
            "سير عمل مضبوط لـ Autodesk / AutoCAD حيث يكون مدعوماً",
          ]
        : [
            "Everything included in the Core installation",
            "AI Draft BOQ workflow configuration",
            "AI-assisted source review and BOQ preparation",
            "Guided measurement and calculation workflows where supported",
            "Controlled Google Drive access when eligible",
            "Controlled Autodesk / AutoCAD workflows where supported",
          ],
    },
    {
      key: "enterprise_authority",
      name: t("publicContent.pricing.saasEnterpriseAuthorityName"),
      priceCode: "enterprise_authority_annual_aed_35000",
      price: "AED 35,000",
      features: locale === "ar"
        ? [
            "كل ما تتضمنه حزمتا Core وScale",
            "استراتيجية كتالوج على مستوى الشركة",
            "تكاملات Enterprise المدعومة وسير عمل API المعتمد",
            "تشغيل متعدد لمساحات العمل وهوية الشركة",
            "واجهة إنجليزية وعربية وحوكمة Enterprise",
            "مراجعة مضبوطة للعروض والعملاء حيث تكون مدعومة",
          ]
        : [
            "Everything included in the Core and Scale installations",
            "Company-wide catalogue strategy",
            "Supported Enterprise integrations and approved API workflows",
            "Multi-workspace operation and company branding",
            "English/Arabic interface and Enterprise governance",
            "Controlled proposal and client review where supported",
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

          <section className="mx-auto mt-12 max-w-6xl rounded-3xl border border-blue-400/20 bg-slate-950/80 p-6 sm:p-8" aria-labelledby="complete-pricing-guide-heading">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">{packageCopy.overviewEyebrow}</p>
              <h2 id="complete-pricing-guide-heading" className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {packageCopy.overviewTitle}
              </h2>
              <p className="mt-4 leading-relaxed text-slate-300">{packageCopy.overviewBody}</p>
            </div>
            <nav className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={packageCopy.overviewEyebrow}>
              <a href="#software-pricing" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-blue-200 hover:border-blue-400/60 hover:text-white">{packageCopy.software}</a>
              <a href="#enterprise-pricing-heading" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-amber-200 hover:border-amber-400/60 hover:text-white">{packageCopy.enterprise}</a>
              <a href="#tayqan-pricing-heading" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-cyan-200 hover:border-cyan-400/60 hover:text-white">{packageCopy.tayqan}</a>
              <a href="#industry-library-pricing-heading" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-emerald-200 hover:border-emerald-400/60 hover:text-white">{packageCopy.libraries}</a>
            </nav>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {packageCopy.layers.map((layer) => (
                <p key={layer} className="rounded-xl bg-slate-900/70 px-4 py-3 text-sm leading-6 text-slate-300">
                  <span className="me-2 text-blue-300" aria-hidden="true">●</span>{layer}
                </p>
              ))}
            </div>
          </section>

          <section id="software-pricing" className="scroll-mt-24 pt-16" aria-label={packageCopy.software}>
            <PricingPlans plans={plans} labels={billingLabels} />

            <div className="mx-auto mt-12 max-w-6xl rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-2xl font-bold text-white">{packageCopy.planGuideTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{packageCopy.planGuideBody}</p>
              </div>
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => {
                  const detail = MARKETPLACE_CONTENT.plans[plan.key];
                  return (
                    <article key={plan.key} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      <dl className="mt-4 space-y-4 text-sm leading-6">
                        <div>
                          <dt className="font-semibold text-blue-300">{packageCopy.bestFor}</dt>
                          <dd className="mt-1 text-slate-300" dir="auto">{detail.bestFor}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-blue-300">{packageCopy.purpose}</dt>
                          <dd className="mt-1 text-slate-300" dir="auto">{detail.purpose}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-blue-300">{packageCopy.whyChoose}</dt>
                          <dd className="mt-1 text-slate-300" dir="auto">{detail.whyChoose}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mx-auto mt-24 max-w-6xl border-t border-slate-800 pt-16" aria-labelledby="enterprise-pricing-heading">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">{packageCopy.enterpriseEyebrow}</p>
              <h2 id="enterprise-pricing-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {packageCopy.enterpriseTitle}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-300">
                {packageCopy.enterpriseBody}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {enterprisePlans.map((plan) => {
                const detail = MARKETPLACE_CONTENT.enterprise[plan.key];
                return (
                <article key={plan.key} data-lead-package-interest={plan.name} className="flex flex-col rounded-3xl border border-amber-400/20 bg-slate-950 p-7">
                  <div className="mb-5">
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-amber-200" dir="auto">{detail.position}</p>
                  </div>
                  <div className="mt-2">
                    <span className="block text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-400">{packageCopy.oneTimePayment}</span>
                  </div>
                  <div className="mt-5 space-y-2 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
                    <p className="flex gap-2"><span aria-hidden="true">✓</span><span>{packageCopy.installationIncluded}</span></p>
                    <p className="flex gap-2"><span aria-hidden="true">✓</span><span>{packageCopy.supportIncluded}</span></p>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                        <span dir="auto">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <details className="group mt-6 border-t border-slate-800 pt-5">
                    <summary className="cursor-pointer text-sm font-semibold text-amber-200 hover:text-amber-100">
                      {packageCopy.fullDetails}
                    </summary>
                    <div className="mt-4 space-y-5 text-sm leading-6 text-slate-400">
                      {detail.bestFor ? (
                        <div>
                          <p className="font-semibold text-slate-200">{packageCopy.bestFor}</p>
                          <p className="mt-1" dir="auto">{detail.bestFor}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="font-semibold text-slate-200">{packageCopy.includedScope}</p>
                        <ul className="mt-2 space-y-2">
                          {detail.includes.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="text-amber-300" aria-hidden="true">—</span>
                              <span dir="auto">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4">
                        <p className="font-semibold text-amber-100">{packageCopy.planMessage}</p>
                        <p className="mt-2 whitespace-pre-line" dir="auto">{detail.keyMessage}</p>
                      </div>
                    </div>
                  </details>
                  <Link
                    href="/contact-sales"
                    className="mt-7 flex h-11 items-center justify-center rounded-lg bg-amber-400 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    {packageCopy.enterpriseCta}
                  </Link>
                </article>
                );
              })}
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
                const packageDetail = plan.plan === "DAY"
                  ? MARKETPLACE_CONTENT.tayqan.tayqan_day
                  : plan.plan === "WEEK"
                    ? MARKETPLACE_CONTENT.tayqan.tayqan_week
                    : MARKETPLACE_CONTENT.tayqan.tayqan_monthly;

                return (
                  <article
                    key={plan.plan}
                    data-lead-package-interest={`TAYQAN ${copy.title}`}
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
                    <p className="mt-2 text-sm font-semibold leading-6 text-cyan-200" dir="auto">{packageDetail.position}</p>
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

          <section className="mx-auto mt-24 max-w-6xl border-t border-slate-800 pt-16" aria-labelledby="industry-library-pricing-heading">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">{packageCopy.libraryEyebrow}</p>
              <h2 id="industry-library-pricing-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {packageCopy.libraryTitle}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-300">{packageCopy.libraryBody}</p>
              <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-3 text-sm leading-6 text-emerald-100">
                {packageCopy.availability}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {CATALOGUE_LIBRARIES.map((library) => {
                const key = library.key as PublicLibraryKey;
                const price = PUBLIC_LIBRARY_PRICES[key];
                const detail = MARKETPLACE_CONTENT.libraries[key] as PublicLibraryDetail;
                const Icon = library.icon;

                return (
                  <article key={library.key} data-lead-package-interest={`${library.displayName} Industry Library`} className="flex flex-col rounded-3xl border border-emerald-400/15 bg-slate-950 p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300" aria-hidden="true">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Industry Library</p>
                        <h3 className="mt-1 text-xl font-bold leading-7 text-white">{library.displayName}</h3>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="text-xl font-extrabold text-white">{price.monthly}</p>
                        <p className="mt-1 text-xs text-slate-400">{packageCopy.monthlyAccess}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="text-xl font-extrabold text-white">{price.annual}</p>
                        <p className="mt-1 text-xs text-slate-400">{packageCopy.annualAccess}</p>
                      </div>
                    </div>

                    <dl className="mt-5 space-y-4 text-sm leading-6">
                      <div>
                        <dt className="font-semibold text-emerald-200">{packageCopy.bestFor}</dt>
                        <dd className="mt-1 text-slate-300" dir="auto">{detail.bestFor}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-emerald-200">{packageCopy.usefulFor}</dt>
                        <dd className="mt-1 text-slate-300" dir="auto">{detail.usefulFor}</dd>
                      </div>
                      {detail.value ? (
                        <div>
                          <dt className="font-semibold text-emerald-200">{packageCopy.whyAdd}</dt>
                          <dd className="mt-1 text-slate-300" dir="auto">{detail.value}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-5 text-slate-400">
                      <span className="font-semibold text-slate-200">{packageCopy.registeredDataset}:</span>{" "}
                      {price.referenceItems} {packageCopy.referenceItems}
                    </p>
                    {detail.important ? (
                      <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100" dir="auto">{detail.important}</p>
                    ) : null}
                    {detail.disclaimer ? (
                      <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100" dir="auto">{detail.disclaimer}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-white">{packageCopy.activationTitle}</h3>
              <p className="mt-4 max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-300" dir="auto">
                {MARKETPLACE_CONTENT.libraryPostPurchase.explanation}
              </p>
              <p className="mt-4 font-semibold text-amber-200" dir="auto">{MARKETPLACE_CONTENT.libraryPostPurchase.important}</p>
              <p className="mt-5 text-sm font-semibold text-white" dir="auto">{MARKETPLACE_CONTENT.libraryPostPurchase.checklistTitle}</p>
              <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETPLACE_CONTENT.libraryPostPurchase.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-300" aria-hidden="true">✓</span>
                    <span dir="auto">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact-sales" className="inline-flex h-12 items-center justify-center rounded-lg bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-500">
                  {packageCopy.contactLibraries}
                </Link>
                <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold text-white hover:bg-slate-900">
                  {packageCopy.existingCustomer}
                </Link>
              </div>
            </div>
          </section>

          <aside className="mx-auto mt-12 max-w-4xl rounded-2xl border border-blue-400/20 bg-blue-400/5 p-6 text-center">
            <h2 className="text-xl font-bold text-white">{packageCopy.checkoutTitle}</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{packageCopy.checkoutBody}</p>
          </aside>

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
