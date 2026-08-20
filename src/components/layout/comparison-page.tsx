import React from "react";
import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getQuantaraProductTruthForDisplay } from "@/lib/public-site/product-truth";
import {
  getPublicSearchPage,
  type PublicSearchPath,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent, type TranslationKey } from "@/lib/i18n/translate";

export interface ComparisonCriteria {
  label: string;
  approachAValue: string;
  approachBValue: string;
}

export interface ComparisonFAQ {
  question: string;
  answer: string;
}

export interface ComparisonPageProps {
  title: string;
  h1: string;
  directAnswer: string;
  approachAName: string;
  approachBName: string;
  whenToChooseA: string[];
  whenToChooseB: string[];
  whenToUseBoth: string[];
  approachADefinition: string;
  approachBDefinition: string;
  comparisonCriteria: ComparisonCriteria[];
  approachAStrengths: string[];
  approachALimitations: string[];
  approachBStrengths: string[];
  approachBLimitations: string[];
  workflowExample: string;
  quantaraRole: string;
  faqs: ComparisonFAQ[];
  relatedLinks: { url: string; label: string }[];
  breadcrumbCurrent: string;
  slug: string;
}

const COMPARISON_ROUTE_KEYS: Record<string, TranslationKey> = {
  "ai-boq-vs-manual-boq-preparation": "publicRoutes.aiBoqVsManualBoqPreparation",
  "boq-software-vs-document-management": "publicRoutes.boqSoftwareVsDocumentManagement",
  "boq-software-vs-spreadsheets": "publicRoutes.boqSoftwareVsSpreadsheets",
  "construction-estimating-software-vs-excel": "publicRoutes.constructionEstimatingSoftwareVsExcel",
  "ocr-vs-structured-boq-extraction": "publicRoutes.ocrVsStructuredBoqExtraction",
  "quantara-vs-excel-for-boq": "publicRoutes.quantaraVsExcelForBoq",
  "quantity-takeoff-vs-boq-software": "publicRoutes.quantityTakeoffVsBoqSoftware",
  "when-to-use-boq-software": "publicRoutes.whenToUseBoqSoftware",
};

export async function ComparisonPage(sourceProps: ComparisonPageProps) {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const routeKey = COMPARISON_ROUTE_KEYS[sourceProps.slug];
  const props = routeKey
    ? translateStructuredContent(t, routeKey, sourceProps)
    : sourceProps;
  const { professionalReviewNotice } = getQuantaraProductTruthForDisplay(t);
  const path = `/${props.slug}` as PublicSearchPath;
  const searchPage = getPublicSearchPage(path);
  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: t("publicLanding.comparisons"), item: "/comparisons" },
    { name: props.breadcrumbCurrent, item: path }
  ];

  const jsonLd = buildPublicPageGraph({
    path: searchPage.path,
    title: searchPage.title,
    description: searchPage.description,
    breadcrumbs: breadcrumbItems.map((item) => ({
      name: item.name,
      path: item.item,
    })),
    faqs: props.faqs,
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#030508] font-sans text-slate-300">
      <PublicJsonLd data={jsonLd} />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20 mt-16">
        <PublicBreadcrumb items={breadcrumbItems} tone="dark" />

        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            {props.h1}
          </h1>
          <p className="mt-6 border-s-4 border-blue-500 bg-slate-900/50 px-5 py-4 text-lg leading-8 text-slate-300">
            {props.directAnswer}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            {professionalReviewNotice}
          </p>
        </header>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">{t("publicLanding.quickDecision")}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <h3 className="font-semibold text-white mb-4">{t("publicLanding.chooseWhen", { approach: props.approachAName })}</h3>
              <ul className="space-y-2">
                {props.whenToChooseA.map((item, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start">
                    <span className="text-blue-400 me-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <h3 className="font-semibold text-white mb-4">{t("publicLanding.chooseWhen", { approach: props.approachBName })}</h3>
              <ul className="space-y-2">
                {props.whenToChooseB.map((item, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start">
                    <span className="text-blue-400 me-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <h3 className="font-semibold text-white mb-4">{t("publicLanding.useBothWhen")}</h3>
              <ul className="space-y-2">
                {props.whenToUseBoth.map((item, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start">
                    <span className="text-blue-400 me-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">{t("publicLanding.definingApproaches")}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-3">{props.approachAName}</h3>
              <p className="text-slate-300">{props.approachADefinition}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-3">{props.approachBName}</h3>
              <p className="text-slate-300">{props.approachBDefinition}</p>
            </div>
          </div>
        </section>

        <section className="mb-16 overflow-x-auto">
          <h2 className="text-2xl font-bold text-white mb-6">{t("publicLanding.capabilityComparison")}</h2>
          <table className="w-full min-w-[600px] border-collapse text-start">
            <caption className="sr-only">
              {t("publicLanding.comparisonCaption", { approachA: props.approachAName, approachB: props.approachBName })}
            </caption>
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-white w-1/3">{t("publicLanding.criteria")}</th>
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-white w-1/3 bg-slate-900/50">{props.approachAName}</th>
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-white w-1/3 bg-slate-900/50">{props.approachBName}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {props.comparisonCriteria.map((c, i) => (
                <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                  <th scope="row" className="py-4 px-4 text-sm font-medium text-white">{c.label}</th>
                  <td className="py-4 px-4 text-sm text-slate-300">{c.approachAValue}</td>
                  <td className="py-4 px-4 text-sm text-slate-300">{c.approachBValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">{t("publicLanding.strengthsLimitations")}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center">
                  <span className="text-emerald-400 me-2">✓</span> {t("publicLanding.strengths", { approach: props.approachAName })}
                </h3>
                <ul className="space-y-2">
                  {props.approachAStrengths.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-slate-400 me-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center">
                  <span className="text-amber-400 me-2">⚠</span> {t("publicLanding.limitations", { approach: props.approachAName })}
                </h3>
                <ul className="space-y-2">
                  {props.approachALimitations.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-slate-400 me-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center">
                  <span className="text-emerald-400 me-2">✓</span> {t("publicLanding.strengths", { approach: props.approachBName })}
                </h3>
                <ul className="space-y-2">
                  {props.approachBStrengths.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-slate-400 me-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center">
                  <span className="text-amber-400 me-2">⚠</span> {t("publicLanding.limitations", { approach: props.approachBName })}
                </h3>
                <ul className="space-y-2">
                  {props.approachBLimitations.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start"><span className="text-slate-400 me-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-4">{t("publicLanding.practicalWorkflow")}</h2>
          <p className="text-slate-300 leading-relaxed mb-6">{props.workflowExample}</p>
          <h3 className="text-xl font-semibold text-white mb-3">{t("publicLanding.howQuantaraFits")}</h3>
          <p className="text-slate-300 leading-relaxed">{props.quantaraRole}</p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8">{t("publicLanding.frequentlyAskedQuestions")}</h2>
          <div className="space-y-6">
            {props.faqs.map((faq, i) => (
              <div key={i} className="pb-6 border-b border-slate-800 last:border-0">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 p-6 bg-slate-950 border border-slate-800 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4">{t("publicLanding.relatedResources")}</h2>
          <ul className="flex flex-wrap gap-4">
            {props.relatedLinks.map((link, i) => (
              <li key={i}>
                <Link href={link.url} className="text-blue-400 hover:text-blue-300 font-medium underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-center bg-slate-950 border border-slate-800 rounded-2xl p-10 mb-16 shadow-sm">
          <h2 className="text-3xl font-bold text-white mb-4">{t("publicLanding.readyOrganize")}</h2>
          <p className="text-slate-300 max-w-2xl mx-auto mb-8">
            {t("publicLanding.organizeBody")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact-sales" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">{t("common.contactSales")}</Link>
            <Link href="/features" className="px-6 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded-lg font-semibold transition-colors">{t("publicLanding.exploreFeatures")}</Link>
          </div>
        </section>

        <section className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl text-center max-w-4xl mx-auto">
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            {t("publicLanding.comparisonDisclaimer")}
          </p>
        </section>
      </div>

      </div>
  );
}
