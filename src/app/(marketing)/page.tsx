import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileOutput,
  FileSearch,
  FolderKanban,
  Info,
  LockKeyhole,
  Mic2,
  ShieldCheck,
} from "lucide-react";

import PublicJsonLd from "@/components/seo/public-json-ld";
import {
  getPublicCapabilityRegisterEntry,
  getPublicCapabilityStatusForDisplay,
  getQuantaraProductTruthForDisplay,
  type PublicCapabilityId,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translate";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";

export const metadata = createPublicPageMetadata("/");

function buildFaqs(t: TranslateFn, pricingAnswer: string) {
  return [
  {
    question: t("publicContent.home.faq.whatQuestion"),
    answer: t("publicContent.home.faq.whatAnswer"),
  },
  {
    question: t("publicContent.home.faq.pdfQuestion"),
    answer: t("publicContent.home.faq.pdfAnswer"),
  },
  {
    question: t("publicContent.home.faq.ocrQuestion"),
    answer: t("publicContent.home.faq.ocrAnswer"),
  },
  {
    question: t("publicContent.home.faq.measureQuestion"),
    answer: t("publicContent.home.faq.measureAnswer"),
  },
  {
    question: t("publicContent.home.faq.replaceQuestion"),
    answer: t("publicContent.home.faq.replaceAnswer"),
  },
  {
    question: t("publicContent.home.faq.voiceQuestion"),
    answer: t("publicContent.home.faq.voiceAnswer"),
  },
  {
    question: t("publicContent.home.faq.driveQuestion"),
    answer: t("publicContent.home.faq.driveAnswer"),
  },
  {
    question: t("publicContent.home.faq.pricingQuestion"),
    answer: pricingAnswer,
  },
] as const;
}

function buildWorkflowStages(t: TranslateFn, aiDraftTitle: string, aiDraftBody: string) {
  return [
    { title: t("publicContent.home.stages.projectSetupTitle"), description: t("publicContent.home.stages.projectSetupBody"), icon: FolderKanban },
    { title: t("publicContent.home.stages.sourcesTitle"), description: t("publicContent.home.stages.sourcesBody"), icon: FileSearch },
    { title: t("publicContent.home.stages.extractionTitle"), description: t("publicContent.home.stages.extractionBody"), icon: ClipboardCheck },
    { title: aiDraftTitle, description: aiDraftBody, icon: ClipboardCheck },
    { title: t("publicContent.home.stages.dimensionsTitle"), description: t("publicContent.home.stages.dimensionsBody"), icon: Calculator },
    { title: t("publicContent.home.stages.calculationsTitle"), description: t("publicContent.home.stages.calculationsBody"), icon: Calculator },
    { title: t("publicContent.home.stages.organizationTitle"), description: t("publicContent.home.stages.organizationBody"), icon: FolderKanban },
    { title: t("publicContent.home.stages.professionalReviewTitle"), description: t("publicContent.home.stages.professionalReviewBody"), icon: ClipboardCheck },
    { title: t("publicContent.home.stages.validationTitle"), description: t("publicContent.home.stages.validationBody"), icon: ShieldCheck },
    { title: t("publicContent.home.stages.outputsTitle"), description: t("publicContent.home.stages.outputsBody"), icon: FileOutput },
  ] as const;
}

const featuredCapabilityIds = [
  "project-workspaces",
  "text-pdf-extraction",
  "spreadsheet-import",
  "google-drive-import",
  "reviewed-extraction",
  "boq-management",
  "visible-calculations",
  "industry-packages",
  "voice-proposals",
  "autodesk-dwg-analysis",
  "professional-outputs",
  "technical-report-generation",
  "bilingual-rtl-interface",
] as const satisfies readonly PublicCapabilityId[];

const statusStyle: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "bg-emerald-950 text-emerald-200",
  CONTROLLED_ACCESS: "bg-blue-950 text-blue-200",
  LIMITED: "bg-amber-950 text-amber-100",
  NOT_AVAILABLE: "bg-slate-800 text-slate-200",
};

export default async function HomePage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const sales = getPublicSalesTruth(locale);
  const featuredCapabilities = featuredCapabilityIds.map((id) =>
    getPublicCapabilityRegisterEntry(id, t),
  );
  const capabilityStatus = Object.fromEntries(
    (["AVAILABLE", "CONTROLLED_ACCESS", "LIMITED", "NOT_AVAILABLE"] as const).map(
      (status) => [status, getPublicCapabilityStatusForDisplay(status, t)],
    ),
  ) as Record<PublicCapabilityStatus, { label: string; description: string }>;
  const productTruth = getQuantaraProductTruthForDisplay(t);
  const workflowStages = buildWorkflowStages(t, sales.aiDraftStageTitle, sales.aiDraftStageBody);
  const faqs = buildFaqs(t, sales.pricingFaqAnswer);
  const trustSignals = [
    t("publicContent.home.trustSupportedSources"),
    t("publicContent.home.trustVisibleCalculations"),
    t("publicContent.home.trustProfessionalConfirmation"),
    t("publicContent.home.trustControlledRecords"),
  ];
  const boundaries = [
    t("publicContent.home.boundaryAutomaticMeasurement"),
    t("publicContent.home.boundaryModelQuantityExtraction"),
    t("publicContent.home.boundaryOcr"),
    t("publicContent.home.boundaryAccuracy"),
    t("publicContent.home.boundaryReplacement"),
    t("publicContent.home.boundaryTraceability"),
    t("publicContent.home.boundaryApproval"),
  ];
  const homeSearchEntry = getPublicSearchPage("/");
  const homeSchema = buildPublicPageGraph({
    path: "/",
    title: homeSearchEntry.title,
    description: homeSearchEntry.description,
    breadcrumbs: [{ name: "Home", path: "/" }],
    faqs,
  });

  return (
    <div className="min-h-screen bg-[#030508] text-white">
      <PublicJsonLd data={homeSchema} />

      <section className="relative overflow-hidden px-4 pb-16 pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top,#172554,transparent_65%)]" />
        <div className="container mx-auto max-w-5xl text-center">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-blue-300">
            {t("publicContent.home.eyebrow")}
          </p>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
            {sales.heroTitle}
          </h1>
          <p className="mx-auto mb-5 max-w-4xl text-xl leading-relaxed text-slate-300">
            {sales.heroBody}
          </p>
          <p className="mx-auto mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
            {sales.heroSignal}
          </p>
          <p className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-slate-400">
            {t("publicContent.home.audience", {
              entityDefinition: productTruth.entityDefinition,
            })}
          </p>
          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-7 font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto">
              {t("publicContent.home.createAccount")} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/features" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-7 font-semibold text-white hover:bg-slate-900 sm:w-auto">
              {t("publicContent.home.checkFeatures")}
            </Link>
            <Link href="/pricing" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-7 font-semibold text-white hover:bg-slate-900 sm:w-auto">
              {sales.viewPricing}
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-400">
            {trustSignals.map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/50 px-4 py-12" aria-label={t("publicContent.home.workspaceAria")}>
        <div className="container mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl sm:p-4">
            <video
              width={1920}
              height={1080}
              autoPlay
              muted
              playsInline
              controls
              preload="metadata"
              aria-label={t("publicContent.home.workspaceAlt")}
              className="aspect-video h-auto w-full rounded-xl border border-slate-800 bg-black object-contain"
            >
              <source src="/videos/quantara-third-pilot-promo.mp4" type="video/mp4" />
              Your browser does not support HTML video.
            </video>
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="accelerated-workflow-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
              {sales.twoWaysEyebrow}
            </p>
            <h2 id="accelerated-workflow-heading" className="mb-4 text-3xl font-bold sm:text-4xl">
              {sales.twoWaysTitle}
            </h2>
            <p className="leading-relaxed text-slate-400">{sales.twoWaysBody}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-900/70 bg-gradient-to-br from-blue-950/50 to-slate-950 p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20">
                <ClipboardCheck className="h-6 w-6 text-blue-300" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-2xl font-bold">{sales.aiDraftTitle}</h3>
              <p className="mb-6 leading-relaxed text-slate-300">{sales.aiDraftBody}</p>
              <Link href="/features" className="inline-flex items-center font-semibold text-blue-300 hover:text-blue-200">
                {sales.aiDraftCta} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>

            <article className="rounded-3xl border border-cyan-900/70 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15">
                <Calculator className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-2xl font-bold">{sales.tayqanTitle}</h3>
              <p className="mb-6 leading-relaxed text-slate-300">{sales.tayqanBody}</p>
              <Link href="/tayqan-ai-quantity-surveyor" className="inline-flex items-center font-semibold text-cyan-300 hover:text-cyan-200">
                {sales.tayqanCta} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20" aria-labelledby="workflow-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">{t("publicContent.home.workflowEyebrow")}</p>
            <h2 id="workflow-heading" className="mb-5 text-3xl font-bold sm:text-4xl">
              {t("publicContent.home.workflowTitle")}
            </h2>
            <p className="leading-relaxed text-slate-400">
              {t("publicContent.home.workflowIntro")}
            </p>
          </div>
          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title} className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-300">{t("publicContent.home.stage", { number: index + 1 })}</span>
                    <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{stage.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{stage.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/40 px-4 py-20" aria-labelledby="capabilities-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <h2 id="capabilities-heading" className="mb-4 text-3xl font-bold">{t("publicContent.home.capabilityTitle")}</h2>
              <p className="leading-relaxed text-slate-400">
                {t("publicContent.home.capabilityIntro")}
              </p>
            </div>
            <Link href="/features" className="inline-flex shrink-0 items-center font-semibold text-blue-300 hover:text-blue-200">
              {t("publicContent.home.capabilityLink")} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCapabilities.map((capability) => (
              <article key={capability.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h3 className="font-bold">{capability.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[capability.status]}`}>
                    {capabilityStatus[capability.status].label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{capability.summary}</p>
                {capability.limitation ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-400"><strong>{t("publicContent.home.boundaryLabel")}</strong> {capability.limitation}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="inputs-heading">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 p-8">
            <h2 id="inputs-heading" className="mb-5 text-3xl font-bold">{t("publicContent.home.sourcesTitle")}</h2>
            <ul className="space-y-5">
              <li className="flex gap-3"><FileSearch className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" /><div><strong>{t("publicContent.home.textPdfLabel")}</strong><p className="mt-1 text-sm text-slate-400">{t("publicContent.home.textPdfBody")}</p></div></li>
              <li className="flex gap-3"><FileSearch className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" /><div><strong>{t("publicContent.home.spreadsheetLabel")}</strong><p className="mt-1 text-sm text-slate-400">{t("publicContent.home.spreadsheetBody")}</p></div></li>
              <li className="flex gap-3"><LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" /><div><strong>{t("publicContent.home.driveLabel")}</strong><p className="mt-1 text-sm text-slate-400">{t("publicContent.home.driveBody")}</p></div></li>
              <li className="flex gap-3"><Info className="mt-1 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" /><div><strong>{t("publicContent.home.scannedPdfLabel")}</strong><p className="mt-1 text-sm text-slate-400">{t("publicContent.home.scannedPdfBody")}</p></div></li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-800 p-8">
            <h2 className="mb-5 text-3xl font-bold">{t("publicContent.home.outputsTitle")}</h2>
            <p className="mb-6 leading-relaxed text-slate-400">
              {t("publicContent.home.outputsBody")}
            </p>
            <div className="mb-6 flex flex-wrap gap-3">
              {["CSV", "XLSX", "PDF", "DOCX", "HTML"].map((format) => (
                <span key={format} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold">{format}</span>
              ))}
            </div>
            <p className="rounded-xl bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">
              {t("publicContent.home.outputsWarning")}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-20 text-white" aria-labelledby="boundaries-heading">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-10 max-w-3xl">
            <h2 id="boundaries-heading" className="mb-4 text-3xl font-bold">{t("publicContent.home.boundariesTitle")}</h2>
            <p className="text-slate-300">{t("publicContent.home.boundariesIntro")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {boundaries.map((boundary) => (
              <div key={boundary} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-slate-200">{boundary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-amber-900/60 bg-amber-950/20 px-4 py-10">
        <div className="container mx-auto flex max-w-5xl gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="mb-2 text-xl font-bold text-amber-100">{t("publicContent.home.responsibilityTitle")}</h2>
            <p className="leading-relaxed text-amber-100/80">{productTruth.professionalReviewNotice}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="faq-heading">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 id="faq-heading" className="mb-4 text-3xl font-bold">{t("publicContent.home.faqTitle")}</h2>
            <p className="text-slate-400">{t("publicContent.home.directAnswers")}</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-slate-800 bg-slate-950 p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none pe-6 font-bold marker:hidden">{faq.question}</summary>
                <p className="mt-4 leading-relaxed text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 text-center">
        <div className="container mx-auto max-w-4xl rounded-3xl bg-blue-700 px-6 py-14 text-white">
          <Mic2 className="mx-auto mb-5 h-8 w-8" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold">{t("publicContent.home.finalCtaTitle")}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-blue-100">
            {t("publicContent.home.finalCtaBody")}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact-sales" className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-6 font-semibold text-blue-800 hover:bg-blue-50">
              {t("publicContent.home.finalCtaAction")} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-300 px-6 font-semibold hover:bg-blue-600">
              {t("publicContent.home.createAccount")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
