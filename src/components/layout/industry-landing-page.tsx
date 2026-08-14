import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import {
  buildPublicPageGraph,
  inferPublicPathFromSchema,
} from "@/lib/public-site/schema";
import {
  getPublicSearchPage,
  type PublicSearchPath,
} from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent, type TranslationKey } from "@/lib/i18n/translate";

export interface IndustryFAQ {
  question: string;
  answer: string;
}

export interface IndustryLandingPageContent {
  path?: string;
  breadcrumbLabel: string;
  title: string;
  audienceDescription: string;
  directAnswer: string;
  challenges: {
    title: string;
    description: string;
  }[];
  workflowDescription: string;
  workflowExample: string;
  typicalCategories: string[];
  supportedInputs: string[];
  plannedInputs: string[];
  supportedOutputs: string[];
  limitations: string[];
  faqs: IndustryFAQ[];
  relatedPages: { label: string; href: string }[];
  /** @deprecated Kept only to infer the route while callers migrate to `path`. */
  schema?: Record<string, unknown>;
}

const INDUSTRY_ROUTE_KEYS: Record<string, TranslationKey> = {
  "/boq-software-for-contractors": "publicRoutes.boqSoftwareForContractors",
  "/boq-software-for-engineering-consultants": "publicRoutes.boqSoftwareForEngineeringConsultants",
  "/boq-software-for-facilities-management": "publicRoutes.boqSoftwareForFacilitiesManagement",
  "/boq-software-for-fire-fighting-contractors": "publicRoutes.boqSoftwareForFireFightingContractors",
  "/boq-software-for-fit-out-companies": "publicRoutes.boqSoftwareForFitOutCompanies",
  "/boq-software-for-hvac-contractors": "publicRoutes.boqSoftwareForHvacContractors",
  "/boq-software-for-mep-contractors": "publicRoutes.boqSoftwareForMepContractors",
  "/boq-software-for-quantity-surveyors": "publicRoutes.boqSoftwareForQuantitySurveyors",
};

export default async function IndustryLandingPage({ content: sourceContent }: { content: IndustryLandingPageContent }) {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const path = sourceContent.path ?? inferPublicPathFromSchema(sourceContent.schema);
  const routeKey = path ? INDUSTRY_ROUTE_KEYS[path] : undefined;
  const content = routeKey
    ? translateStructuredContent(t, routeKey, sourceContent)
    : sourceContent;
  const searchPage = path ? getPublicSearchPage(path as PublicSearchPath) : null;
  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: t("navigation.industries"), item: "/industries" },
    { name: content.breadcrumbLabel, item: path ?? undefined },
  ];
  const jsonLd = searchPage
    ? buildPublicPageGraph({
        path: searchPage.path,
        title: searchPage.title,
        description: searchPage.description,
        breadcrumbs: breadcrumbItems.map((item) => ({
          name: item.name,
          path: item.item,
        })),
        faqs: content.faqs,
      })
    : null;

  return (
    <div className="w-full bg-white text-slate-900 font-sans">
      {jsonLd && <PublicJsonLd data={jsonLd} />}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-12 md:py-16">
        <PublicBreadcrumb items={breadcrumbItems} tone="light" />

        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            {content.title}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-6 font-medium">
            {content.audienceDescription}
          </p>
          <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 mb-8">
            <p className="font-semibold">{content.directAnswer}</p>
          </div>
        </header>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">{t("publicLanding.industryChallenges")}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {content.challenges.map((challenge, idx) => (
              <div key={idx} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-lg mb-2">{challenge.title}</h3>
                <p className="text-slate-600">{challenge.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">{t("publicLanding.howQuantaraSupports")}</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed mb-6">{content.workflowDescription}</p>
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-blue-600 rtl:rotate-180" /> {t("publicLanding.practicalExample")}
              </h3>
              <p className="text-slate-600">{content.workflowExample}</p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">{t("publicLanding.capabilitiesScope")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t("publicLanding.supportedInputs")}
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.supportedInputs.map((input, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {input}
                  </li>
                ))}
              </ul>
              <h4 className="font-semibold text-slate-900 mt-6 mb-3 text-sm text-slate-500">{t("publicLanding.notCurrentlySupported")}</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                {content.plannedInputs.map((input, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {input} ({t("publicLanding.notAvailable")})
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t("publicLanding.typicalCategories")}
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.typicalCategories.map((cat, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {cat}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-4 italic">{t("publicLanding.industryLibraryNote")}</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t("publicLanding.supportedOutputs")}
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.supportedOutputs.map((output, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {output}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
            <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {t("publicLanding.limitationsDisclaimer")}
            </h2>
            <ul className="space-y-2 text-sm text-amber-800 mb-6 list-disc ps-5">
              {content.limitations.map((limitation, idx) => (
                <li key={idx}>{limitation}</li>
              ))}
            </ul>
            <p className="text-sm text-amber-900 font-medium p-4 bg-amber-100/50 rounded-lg">
              {t("publicLanding.industryProfessionalDisclaimer")}
            </p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">{t("publicLanding.frequentlyAskedQuestions")}</h2>
          <div className="space-y-6">
            {content.faqs.map((faq, idx) => (
              <div key={idx} className="group">
                <h3 className="font-semibold text-slate-900 mb-2">{faq.question}</h3>
                <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">{t("publicLanding.relatedResources")}</h2>
          <div className="flex flex-wrap gap-4">
            {content.relatedPages.map((page, idx) => (
              <Link key={idx} href={page.href} className="px-4 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 transition-colors">
                {page.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("publicLanding.readyStructure")}</h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
            <Link href="/register" className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            {t("publicContent.cta.startAccountSetup")}
            </Link>
            <Link href="/features" className="w-full sm:w-auto px-6 py-3 bg-white text-slate-700 border border-slate-300 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              {t("publicLanding.exploreFeaturesAction")}
            </Link>
            <Link href="/contact-sales" className="w-full sm:w-auto px-6 py-3 bg-white text-slate-700 border border-slate-300 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              {t("publicLanding.contactSalesAction")}
            </Link>
          </div>
        </section>
      </div>

    </div>
  );
}
