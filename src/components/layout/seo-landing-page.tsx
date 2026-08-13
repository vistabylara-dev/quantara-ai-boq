import React, { type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown } from "lucide-react";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import {
  PUBLIC_CAPABILITY_STATUS_LABELS,
  getPublicCapability,
  getPublicCapabilityForDisplay,
  getPublicCapabilityStatusForDisplay,
  getQuantaraProductTruthForDisplay,
  type PublicCapabilityId,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import {
  getPublicSearchPage,
  type PublicSearchPath,
} from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent, type TranslationKey } from "@/lib/i18n/translate";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

type SeoCapabilityItem = {
  capabilityId: PublicCapabilityId;
  name: string;
  description: string;
  limitation?: string;
};

export interface SeoLandingPageContent {
  breadcrumbLabel: string;
  h1: string;
  directDefinition: string;
  audience: {
    heading: string;
    content: string;
    items?: string[];
  };
  workflowProblem: {
    heading: string;
    paragraphs: (string | ReactNode)[];
    items?: string[];
  };
  quantaraSupport: {
    heading: string;
    paragraphs: (string | ReactNode)[];
  };
  relevantFeatures: SeoCapabilityItem[];
  workflowExample: {
    heading: string;
    introduction: string;
    steps: Array<{
      title: string;
      description: string;
    }>;
  };
  supportedInputs: SeoCapabilityItem[];
  supportedOutputs: SeoCapabilityItem[];
  limitations: string[];
  faqs: Array<{
    question: string;
    answer: string | ReactNode;
    schemaAnswer?: string;
  }>;
  relatedPages: Array<{
    href: string;
    label: string;
    description: string;
  }>;
}

const statusColors: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "bg-green-500",
  CONTROLLED_ACCESS: "bg-blue-500",
  LIMITED: "bg-amber-400",
  NOT_AVAILABLE: "bg-slate-300 dark:bg-slate-700",
};

const statusBadgeColors: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CONTROLLED_ACCESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  LIMITED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NOT_AVAILABLE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function getPublicStatus(capabilityId: PublicCapabilityId, translate: ReturnType<typeof createTranslator>) {
  const canonicalStatus = getPublicCapability(capabilityId).status;
  return {
    canonicalStatus,
    label: getPublicCapabilityStatusForDisplay(canonicalStatus, translate).label,
  };
}

function getCapabilityBoundary(
  capabilityId: PublicCapabilityId,
  translate: ReturnType<typeof createTranslator>,
): string | undefined {
  if (capabilityId === "technical-report-generation") {
    return translate("publicContent.shared.technicalReportBoundary");
  }
  return getPublicCapabilityForDisplay(capabilityId, translate).limitation;
}

const SEO_ROUTE_KEYS: Record<string, TranslationKey> = {
  "/ai-boq-software": "publicRoutes.aiBoqSoftware",
  "/boq-document-generation": "publicRoutes.boqDocumentGeneration",
  "/boq-management": "publicRoutes.boqManagement",
  "/boq-software": "publicRoutes.boqSoftware",
  "/boq-software-abu-dhabi": "publicRoutes.boqSoftwareAbuDhabi",
  "/boq-software-dubai": "publicRoutes.boqSoftwareDubai",
  "/boq-software-oman": "publicRoutes.boqSoftwareOman",
  "/boq-software-qatar": "publicRoutes.boqSoftwareQatar",
  "/boq-software-saudi-arabia": "publicRoutes.boqSoftwareSaudiArabia",
  "/construction-estimating-software": "publicRoutes.constructionEstimatingSoftware",
  "/pdf-boq-extraction": "publicRoutes.pdfBoqExtraction",
  "/quantity-surveying-software": "publicRoutes.quantitySurveyingSoftware",
  "/scanned-pdf-boq": "publicRoutes.scannedPdfBoq",
};

export default async function SeoLandingPage({ content: sourceContent, currentPath }: { content: SeoLandingPageContent; currentPath: string }) {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const routeKey = SEO_ROUTE_KEYS[currentPath];
  const content = routeKey
    ? translateStructuredContent(t, routeKey, sourceContent)
    : sourceContent;
  const { professionalReviewNotice } = getQuantaraProductTruthForDisplay(t);
  const searchPage = getPublicSearchPage(currentPath as PublicSearchPath);
  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: content.breadcrumbLabel, item: currentPath },
  ];
  const schemaFaqs = content.faqs.flatMap((faq) => {
    const answer = faq.schemaAnswer ?? (typeof faq.answer === "string" ? faq.answer : null);
    return answer ? [{ question: faq.question, answer }] : [];
  });
  const jsonLd = buildPublicPageGraph({
    path: searchPage.path,
    title: searchPage.title,
    description: searchPage.description,
    breadcrumbs: breadcrumbItems.map((item) => ({ name: item.name, path: item.item })),
    faqs: schemaFaqs,
  });

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100">
      <PublicJsonLd data={jsonLd} />
      <div className="flex-1 pb-24">
        {/* Breadcrumb */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 dark:border-slate-800/50 dark:bg-slate-900/30">
          <div className="container mx-auto max-w-4xl">
            <PublicBreadcrumb items={breadcrumbItems} className="text-sm" />
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 pt-16 pb-12">
          {/* Hero Section */}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white leading-tight">
            {content.h1}
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed font-medium mb-16">
            {content.directDefinition}
          </p>

          <div className="space-y-16">
            {/* Who is it for */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.audience.heading}</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {content.audience.content}
              </p>
              {content.audience.items && (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                  {content.audience.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Workflow Problem */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.workflowProblem.heading}</h2>
              <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {content.workflowProblem.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              {content.workflowProblem.items && (
                <ul className="mt-6 space-y-3">
                  {content.workflowProblem.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* How Quantara Supports */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.quantaraSupport.heading}</h2>
              <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {content.quantaraSupport.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </section>

            {/* Relevant Features */}
            <section>
              <h2 className="text-2xl font-bold mb-6">{t("publicLanding.relevantFeatures")}</h2>
              <div className="grid gap-6">
                {content.relevantFeatures.map((feature) => {
                  const status = getPublicStatus(feature.capabilityId, t);
                  return (
                    <div key={feature.name} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{feature.name}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${statusColors[status.canonicalStatus]}`} aria-hidden="true" />
                        {status.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Practical Workflow Example */}
            <section className="bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-8 border border-blue-100 dark:border-blue-900/30">
              <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{content.workflowExample.heading}</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">{content.workflowExample.introduction}</p>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ms-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-200 dark:before:via-blue-800 before:to-transparent">
                {content.workflowExample.steps.map((step, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#030508] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                      <span className="font-bold text-sm">{idx + 1}</span>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Inputs & Outputs Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h2 className="text-2xl font-bold mb-6">{t("publicLanding.supportedInputs")}</h2>
                <div className="space-y-4">
                  {content.supportedInputs.map((input) => {
                    const status = getPublicStatus(input.capabilityId, t);
                    const boundary = getCapabilityBoundary(input.capabilityId, t) ?? input.limitation;
                    return (
                      <div key={input.name} className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{input.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeColors[status.canonicalStatus]}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{input.description}</p>
                        {boundary && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">{t("publicLanding.note")} {boundary}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-6">{t("publicLanding.supportedOutputs")}</h2>
                <div className="space-y-4">
                  {content.supportedOutputs.map((output) => {
                    const status = getPublicStatus(output.capabilityId, t);
                    const boundary = getCapabilityBoundary(output.capabilityId, t) ?? output.limitation;
                    return (
                      <div key={output.name} className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{output.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeColors[status.canonicalStatus]}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{output.description}</p>
                        {boundary && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">{t("publicLanding.note")} {boundary}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Limitations */}
            <section className="bg-slate-50 dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h2 className="text-2xl font-bold mb-4">{t("publicLanding.currentLimitations")}</h2>
              <ul className="space-y-3">
                {content.limitations.map((limit, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0 mt-2.5" />
                    <span className="leading-relaxed">{limit}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Professional Disclaimer */}
            <section className="rounded-e-xl border-s-4 border-amber-500 bg-amber-50 p-6 dark:bg-amber-900/20">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">{t("publicLanding.professionalDisclaimer")}</h3>
              <p className="text-amber-700 dark:text-amber-400/90 text-sm leading-relaxed">
                {professionalReviewNotice}
              </p>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-3xl font-bold mb-8 text-center">{t("publicLanding.frequentlyAskedQuestions")}</h2>
              <div className="max-w-3xl mx-auto space-y-4">
                {content.faqs.map((faq) => (
                  <details key={faq.question} className="group overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <summary className="flex w-full cursor-pointer list-none items-center justify-between px-6 py-4 text-start focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset [&::-webkit-details-marker]:hidden">
                      <span className="pe-4 font-semibold text-slate-900 dark:text-slate-100">{faq.question}</span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-6 pb-4">
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* Related Pages */}
            <section className="border-t border-slate-200 dark:border-slate-800 pt-16">
              <h2 className="text-2xl font-bold mb-6">{t("publicLanding.relatedResources")}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.relatedPages.map((page, idx) => (
                  <Link key={idx} href={page.href} className="group p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors block">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{page.label}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{page.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-blue-600 mt-auto">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">{t("publicLanding.readyReview")}</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg text-base font-bold bg-white text-blue-700 hover:bg-slate-50 h-14 px-8 py-4 shadow-lg w-full sm:w-auto">
              {t("publicContent.cta.startAccountSetup")}
            </Link>
            <Link href="/features" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-blue-400 bg-transparent text-white hover:bg-blue-700 h-14 px-8 py-4 w-full sm:w-auto">
              {t("publicLanding.exploreFeatures")}
            </Link>
          </div>
        </div>
      </section>

      </div>
  );
}
