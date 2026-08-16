import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  PlugZap,
  Workflow,
} from "lucide-react";

import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import {
  INTEGRATION_CATEGORY_LABELS,
  PROVIDER_REGISTRY,
} from "@/lib/integrations/provider-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  PUBLIC_INTEGRATION_IDS,
  type PublicIntegrationId,
} from "@/lib/public-site/public-integration-ids";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";
import {
  PUBLIC_SITE_ORIGIN,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

type PageProps = {
  params: Promise<{ providerId: string }>;
};

const copy = {
  en: {
    integrations: "Integrations",
    eyebrow: "Quantara construction-software integration",
    introPrefix: "Connect",
    introSuffix:
      "project information to Quantara's controlled BOQ workflow and keep review, measurement, AI Draft, TAYQAN and professional delivery connected.",
    approach: "Connection approach",
    scopeTitle: "Integration scope",
    scopeBody:
      "The integration is structured around the project information and workflow types below.",
    journeyTitle: "How this integration fits the Quantara BOQ journey",
    steps: [
      ["Bring in project information", "Select the relevant project, file, schedule, model information or commercial data from the connected workflow."],
      ["Review project evidence", "Keep the imported project information visible and reviewable before it becomes governed BOQ data."],
      ["Build and measure the BOQ", "Use AI Draft BOQ, guided measurement and deterministic calculations where they fit the project evidence."],
      ["Deliver with your team or TAYQAN", "Continue directly in Quantara or use TAYQAN as Digital QS capacity for governed BOQ preparation and final QA."],
    ],
    faqTitle: "Integration questions",
    faqOne: "What does the Quantara integration with {name} support?",
    faqOneAnswer:
      "The Quantara integration page covers project-source, data and workflow connections between {name} and Quantara. Imported information remains part of a review-led BOQ workflow.",
    faqTwo: "Does the integration automatically approve BOQ quantities?",
    faqTwoAnswer:
      "No. Connected project information can support BOQ work, but measurements, calculations, rates and final outputs remain subject to professional review and acceptance.",
    faqThree: "Can TAYQAN work with information from this integration?",
    faqThreeAnswer:
      "TAYQAN can work inside Quantara's governed project workflow once supported project information is available for review, quantity preparation, BOQ assembly and final QA.",
    finalTitle: "Use {name} inside a connected BOQ workflow",
    finalBody:
      "Create a Quantara account, explore the full feature set, or hire TAYQAN when you want Digital QS capacity on the project.",
    createAccount: "Create account",
    features: "View features",
    tayqan: "Explore TAYQAN",
  },
  ar: {
    integrations: "التكاملات",
    eyebrow: "تكامل Quantara مع برامج البناء",
    introPrefix: "اربط معلومات مشروع",
    introSuffix:
      "بسير عمل Quantara المنضبط لـ BOQ، وحافظ على ترابط المراجعة والقياس وAI Draft وTAYQAN والتسليم المهني.",
    approach: "طريقة الاتصال",
    scopeTitle: "نطاق التكامل",
    scopeBody:
      "يتم تنظيم التكامل حول أنواع معلومات المشروع وسير العمل الموضحة أدناه.",
    journeyTitle: "كيف يدخل هذا التكامل ضمن رحلة BOQ في Quantara",
    steps: [
      ["إدخال معلومات المشروع", "حدد المشروع أو الملف أو الجدول أو معلومات النموذج أو البيانات التجارية ذات الصلة من سير العمل المتصل."],
      ["مراجعة أدلة المشروع", "احتفظ بالمعلومات المستوردة ظاهرة وقابلة للمراجعة قبل أن تصبح بيانات BOQ خاضعة للضوابط."],
      ["إنشاء وقياس BOQ", "استخدم AI Draft BOQ والقياس الموجّه والحسابات الحتمية عندما تناسب أدلة المشروع."],
      ["التسليم مع فريقك أو TAYQAN", "تابع العمل مباشرة داخل Quantara أو استخدم TAYQAN كمسّاح كميات رقمي لإعداد BOQ والمراجعة النهائية."],
    ],
    faqTitle: "أسئلة التكامل",
    faqOne: "ماذا يدعم تكامل Quantara مع {name}؟",
    faqOneAnswer:
      "تغطي صفحة التكامل الربط بين مصادر المشروع والبيانات وسير العمل في {name} وQuantara. وتبقى المعلومات المستوردة ضمن سير عمل BOQ خاضع للمراجعة.",
    faqTwo: "هل يعتمد التكامل كميات BOQ تلقائياً؟",
    faqTwoAnswer:
      "لا. يمكن لمعلومات المشروع المتصلة دعم عمل BOQ، لكن القياسات والحسابات والأسعار والمخرجات النهائية تظل خاضعة للمراجعة والقبول المهني.",
    faqThree: "هل يمكن لـ TAYQAN العمل على المعلومات القادمة من هذا التكامل؟",
    faqThreeAnswer:
      "يمكن لـ TAYQAN العمل داخل سير عمل المشروع المنضبط في Quantara بعد توفر معلومات المشروع المدعومة للمراجعة وإعداد الكميات وتجميع BOQ والمراجعة النهائية.",
    finalTitle: "استخدم {name} داخل سير عمل BOQ متصل",
    finalBody:
      "أنشئ حساب Quantara، واستكشف مجموعة الميزات الكاملة، أو وظّف TAYQAN عندما تحتاج قدرة مسّاح كميات رقمي للمشروع.",
    createAccount: "إنشاء حساب",
    features: "عرض الميزات",
    tayqan: "استكشف TAYQAN",
  },
} as const;

function getProvider(providerId: string) {
  return PROVIDER_REGISTRY.find((provider) => provider.id === providerId);
}

function connectionLabel(
  connectionType: (typeof PROVIDER_REGISTRY)[number]["connectionType"],
  locale: "en" | "ar",
) {
  const labels = {
    OAUTH_CLOUD: {
      en: "Connected cloud workflow",
      ar: "سير عمل سحابي متصل",
    },
    PLUGIN_DESKTOP: {
      en: "Desktop connector workflow",
      ar: "سير عمل عبر موصل سطح المكتب",
    },
    API_KEY: {
      en: "API credential workflow",
      ar: "سير عمل باستخدام بيانات اعتماد API",
    },
    SERVICE_ACCOUNT: {
      en: "Service account workflow",
      ar: "سير عمل باستخدام حساب خدمة",
    },
    WEBHOOK: {
      en: "Webhook integration workflow",
      ar: "سير عمل تكامل عبر Webhook",
    },
    FILE_IMPORT: {
      en: "Project file and data exchange workflow",
      ar: "سير عمل لتبادل ملفات وبيانات المشروع",
    },
  } as const;

  if (connectionType in labels) {
    const knownType = connectionType as keyof typeof labels;
    return labels[knownType][locale];
  }

  return locale === "ar"
    ? "سير عمل تكامل التطبيق"
    : "Application integration workflow";
}

function replaceName(template: string, name: string) {
  return template.replace("{name}", name);
}

export function generateStaticParams() {
  return PUBLIC_INTEGRATION_IDS.map((providerId) => ({ providerId }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) {
    return {};
  }

  const canonical = `${PUBLIC_SITE_ORIGIN}/boq-integrations/${provider.id}`;
  const title = `${provider.displayName} Integration with Quantara`;
  const description =
    `Explore how ${provider.displayName} fits into Quantara project-source, BOQ, measurement, review and Digital QS workflows.`;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: { "en-AE": canonical },
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Quantara",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function IntegrationDetailPage({ params }: PageProps) {
  const { providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) {
    notFound();
  }

  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const pageCopy = copy[locale];
  const sales = getPublicSalesTruth(locale);
  const categoryLabel = INTEGRATION_CATEGORY_LABELS[provider.category];
  const scope = [...new Set([...provider.supportedData, ...provider.plannedData])];

  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: pageCopy.integrations, item: "/boq-integrations" },
    {
      name: provider.displayName,
      item: `/boq-integrations/${provider.id}`,
    },
  ];

  const faqs = [
    {
      question: replaceName(pageCopy.faqOne, provider.displayName),
      answer: replaceName(pageCopy.faqOneAnswer, provider.displayName),
    },
    {
      question: pageCopy.faqTwo,
      answer: pageCopy.faqTwoAnswer,
    },
    {
      question: pageCopy.faqThree,
      answer: pageCopy.faqThreeAnswer,
    },
  ];

  const title = `${provider.displayName} Integration with Quantara`;
  const description =
    `${provider.displayName} integration for project-source, BOQ, measurement, review and Digital QS workflows.`;

  const jsonLd = buildPublicPageGraph({
    path: `/boq-integrations/${provider.id}`,
    title,
    description,
    breadcrumbs: breadcrumbItems.map((item) => ({
      name: item.name,
      path: item.item,
    })),
    faqs,
    dateModified: "2026-08-16",
  });

  return (
    <div className="min-h-screen bg-[#030508] text-white">
      <PublicJsonLd data={jsonLd} />

      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-20">
        <PublicBreadcrumb items={breadcrumbItems} />

        <header className="mt-10">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
            {pageCopy.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-4xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            {pageCopy.introPrefix} {provider.displayName}{" "}
            {pageCopy.introSuffix}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
              {categoryLabel}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
              {provider.familyDisplayName}
            </span>
            <span className="rounded-full border border-cyan-900 bg-cyan-950/30 px-4 py-2 text-sm text-cyan-200">
              {pageCopy.approach}: {connectionLabel(provider.connectionType, locale)}
            </span>
          </div>
        </header>

        <section className="mt-16 rounded-3xl border border-slate-800 bg-slate-950 p-8">
          <PlugZap className="h-8 w-8 text-cyan-300" aria-hidden="true" />
          <h2 className="mt-5 text-3xl font-bold">{pageCopy.scopeTitle}</h2>
          <p className="mt-3 text-slate-400">{pageCopy.scopeBody}</p>

          {scope.length > 0 ? (
            <div className="mt-7 grid gap-3 md:grid-cols-2">
              {scope.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-xl border border-slate-800 bg-[#05080d] p-4 text-sm text-slate-300"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-16">
          <div className="mb-8 flex items-center gap-3">
            <Workflow className="h-7 w-7 text-blue-300" aria-hidden="true" />
            <h2 className="text-3xl font-bold">{pageCopy.journeyTitle}</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {pageCopy.steps.map(([stepTitle, stepBody], index) => (
              <article
                key={stepTitle}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-950 text-sm font-bold text-blue-300">
                    {index + 1}
                  </span>
                  <h3 className="font-bold">{stepTitle}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  {stepBody}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-blue-900/70 bg-blue-950/20 p-7">
            <h2 className="text-2xl font-bold">{sales.aiDraftTitle}</h2>
            <p className="mt-4 leading-relaxed text-slate-300">
              {sales.aiDraftBody}
            </p>
            <Link
              href="/features"
              className="mt-6 inline-flex items-center font-semibold text-blue-300"
            >
              {sales.aiDraftCta}
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </article>

          <article className="rounded-3xl border border-cyan-900/70 bg-cyan-950/20 p-7">
            <h2 className="text-2xl font-bold">{sales.tayqanTitle}</h2>
            <p className="mt-4 leading-relaxed text-slate-300">
              {sales.tayqanBody}
            </p>
            <Link
              href="/tayqan-ai-quantity-surveyor"
              className="mt-6 inline-flex items-center font-semibold text-cyan-300"
            >
              {sales.tayqanCta}
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        </section>

        <section className="mt-16">
          <h2 className="text-3xl font-bold">{pageCopy.faqTitle}</h2>
          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
              >
                <h3 className="font-bold">{faq.question}</h3>
                <p className="mt-3 leading-relaxed text-slate-400">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center md:p-12">
          <h2 className="text-3xl font-bold">
            {replaceName(pageCopy.finalTitle, provider.displayName)}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            {pageCopy.finalBody}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-6 font-semibold text-white hover:bg-cyan-500"
            >
              {pageCopy.createAccount}
            </Link>
            <Link
              href="/features"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold text-white hover:bg-slate-900"
            >
              {pageCopy.features}
            </Link>
            <Link
              href="/tayqan-ai-quantity-surveyor"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold text-white hover:bg-slate-900"
            >
              {pageCopy.tayqan}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}