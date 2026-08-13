import Image from "next/image";
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
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITY_STATUS_LABELS,
  QUANTARA_ENTITY_DEFINITION,
  QUANTARA_WORKFLOW_TRUTH,
  getPublicCapabilityForDisplay,
  type PublicCapabilityId,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/");

function buildFaqs(commercialAnswer: string) {
  return [
  {
    question: "What is Quantara?",
    answer:
      "Quantara is AI-assisted BOQ workflow software for construction professionals. It supports reviewed project information, dimensions, visible calculations, BOQ organization, validation and professional outputs without replacing professional judgement.",
  },
  {
    question: "Can Quantara process construction PDFs?",
    answer:
      "Quantara stores extractable text from text-based PDFs and creates review candidates only from supported detected table rows. Plain paragraph text is not converted into BOQ candidates, and every table result must be checked against the original source.",
  },
  {
    question: "Does Quantara perform OCR on scanned PDFs?",
    answer:
      "No. Quantara can detect image-only PDF pages, but it does not currently extract their text with OCR, so scanned content needs a manual review and transcription path.",
  },
  {
    question: "Does Quantara measure drawings automatically?",
    answer:
      "No. Quantara does not currently derive final dimensions or quantities automatically from drawing geometry; responsible professionals provide or confirm the required measurements.",
  },
  {
    question: "Can Quantara replace a quantity surveyor?",
    answer:
      "No. Quantara assists with supported extraction, calculation visibility, organization, validation and document generation, while the responsible professional retains judgement and approval responsibility.",
  },
  {
    question: "Can voice change a BOQ without confirmation?",
    answer:
      "No. In controlled-access BOQ contexts, voice can produce a visible proposal for one supported measurement or item-field change, and the user must confirm it before governed project data changes.",
  },
  {
    question: "Does Quantara connect to Google Drive?",
    answer:
      "Google Drive project-file import is a controlled-access capability. Availability depends on an authorized workspace connection, account access and supported file types.",
  },
  {
    question: "How is Quantara pricing confirmed?",
    answer: commercialAnswer,
  },
] as const;
}

const workflowStages = [
  { title: "Project setup", description: "Create the controlled project workspace and confirm the project context.", icon: FolderKanban },
  { title: "Supported sources", description: "Upload text-based PDFs or structured spreadsheets, or use an authorized source connection where enabled.", icon: FileSearch },
  { title: "Reviewed extraction", description: "Confirm, correct or reject supported extracted information before later BOQ use.", icon: ClipboardCheck },
  { title: "Dimensions", description: "Provide and review required dimensions for supported deterministic measurement types.", icon: Calculator },
  { title: "Visible calculations", description: "Inspect the equation, inputs, deductions or allowances and proposed result before confirmation.", icon: Calculator },
  { title: "BOQ organization", description: "Structure sections, items, quantities, units and project revisions.", icon: FolderKanban },
  { title: "Professional review", description: "Review scope, descriptions, quantities, units, rates, assumptions and exceptions.", icon: ClipboardCheck },
  { title: "Validation", description: "Review supported validation findings before relying on an output.", icon: ShieldCheck },
  { title: "Professional outputs", description: "Generate supported BOQ outputs; DOCX technical reports remain limited to configured environments.", icon: FileOutput },
] as const;

const featuredCapabilityIds = [
  "text-pdf-extraction",
  "spreadsheet-import",
  "google-drive-import",
  "visible-calculations",
  "voice-proposals",
  "professional-outputs",
] as const satisfies readonly PublicCapabilityId[];

const statusStyle: Record<PublicCapabilityStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CONTROLLED_ACCESS: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  LIMITED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  NOT_AVAILABLE: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export default async function HomePage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const featuredCapabilities = featuredCapabilityIds.map((id) =>
    getPublicCapabilityForDisplay(id, t),
  );
  const faqs = buildFaqs(t("publicContent.home.commercialFaq"));
  const homeSearchEntry = getPublicSearchPage("/");
  const homeSchema = buildPublicPageGraph({
    path: "/",
    title: homeSearchEntry.title,
    description: homeSearchEntry.description,
    breadcrumbs: [{ name: "Home", path: "/" }],
    faqs,
  });

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <PublicJsonLd data={homeSchema} />

      <section className="relative overflow-hidden px-4 pb-16 pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_65%)] dark:bg-[radial-gradient(circle_at_top,#172554,transparent_65%)]" />
        <div className="container mx-auto max-w-5xl text-center">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
            Dubai · UAE · GCC construction workflows
          </p>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
            AI-Assisted BOQ Workflow Software for UAE Construction Teams
          </h1>
          <p className="mx-auto mb-5 max-w-4xl text-xl leading-relaxed text-slate-700 dark:text-slate-300">
            {QUANTARA_WORKFLOW_TRUTH}
          </p>
          <p className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {QUANTARA_ENTITY_DEFINITION} It is designed for contractors, estimators, quantity
            surveyors, consultants and specialist project teams in Dubai, Abu Dhabi, Sharjah and
            the wider GCC.
          </p>
          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-7 font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto">
              {t("publicContent.cta.startAccountSetup")} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/features" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-7 font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 sm:w-auto">
              Check Feature Availability
            </Link>
            <Link href="/contact-sales" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-7 font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 sm:w-auto">
              Discuss Your Requirements
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-600 dark:text-slate-400">
            {[
              "Supported source workflows",
              "Visible calculations",
              "Explicit professional confirmation",
              "Controlled project records",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/50" aria-label="Quantara product workspace preview">
        <div className="container mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-4">
            <Image
              src="/workspace-preview.png"
              alt="Quantara project workspace showing BOQ metrics, project sources and project activity"
              width={1024}
              height={603}
              priority
              sizes="(max-width: 1200px) 100vw, 1152px"
              className="h-auto w-full rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="workflow-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Review-led workflow</p>
            <h2 id="workflow-heading" className="mb-5 text-3xl font-bold sm:text-4xl">
              From Project Sources to Professional Outputs
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-400">
              Quantara keeps assistance and professional decisions separate. Each stage gives the
              project team a clear review point before information is relied on downstream.
            </p>
          </div>
          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Stage {index + 1}</span>
                    <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{stage.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{stage.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-20 dark:border-slate-800 dark:bg-slate-900/40" aria-labelledby="capabilities-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <h2 id="capabilities-heading" className="mb-4 text-3xl font-bold">Current Capability Highlights</h2>
              <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                Status labels are explicit. “Controlled access” depends on configuration,
                connection or entitlement; “Limited” must be read with the stated boundary.
              </p>
            </div>
            <Link href="/features" className="inline-flex shrink-0 items-center font-semibold text-blue-700 hover:text-blue-600 dark:text-blue-300">
              View the full register <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCapabilities.map((capability) => (
              <article key={capability.id} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h3 className="font-bold">{capability.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[capability.status]}`}>
                    {PUBLIC_CAPABILITY_STATUS_LABELS[capability.status]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{capability.summary}</p>
                {capability.limitation ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400"><strong>Boundary:</strong> {capability.limitation}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="inputs-heading">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 p-8 dark:border-slate-800">
            <h2 id="inputs-heading" className="mb-5 text-3xl font-bold">Supported Source Paths</h2>
            <ul className="space-y-5">
              <li className="flex gap-3"><FileSearch className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /><div><strong>Text-based PDF:</strong><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Supported text and table information can be captured for review; complex layouts may need correction.</p></div></li>
              <li className="flex gap-3"><FileSearch className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /><div><strong>XLSX and CSV:</strong><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Structured spreadsheet data can enter a mapped, reviewable project workflow.</p></div></li>
              <li className="flex gap-3"><LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" /><div><strong>Google Drive:</strong><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Selected supported files can be imported when the authorized connection and access are enabled.</p></div></li>
              <li className="flex gap-3"><Info className="mt-1 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" /><div><strong>Scanned PDF:</strong><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Image-only pages are detected, but OCR extraction is not currently available.</p></div></li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 p-8 dark:border-slate-800">
            <h2 className="mb-5 text-3xl font-bold">Supported Output Types</h2>
            <p className="mb-6 leading-relaxed text-slate-600 dark:text-slate-400">
              Supported document flows generate CSV, XLSX, PDF, DOCX or HTML outputs from reviewed
              project records and templates. Output availability depends on the selected workflow.
            </p>
            <div className="mb-6 flex flex-wrap gap-3">
              {["CSV", "XLSX", "PDF", "DOCX", "HTML"].map((format) => (
                <span key={format} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold dark:bg-slate-900">{format}</span>
              ))}
            </div>
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              Generated files do not constitute tender approval, contractual acceptance, design
              verification or professional certification.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-20 text-white" aria-labelledby="boundaries-heading">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-10 max-w-3xl">
            <h2 id="boundaries-heading" className="mb-4 text-3xl font-bold">What Quantara Does Not Claim</h2>
            <p className="text-slate-300">Clear boundaries help UAE and GCC construction teams assess product fit responsibly.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              "No automatic drawing measurement or final quantity takeoff from geometry.",
              "No OCR text extraction from scanned or image-only PDF pages.",
              "No guarantee of extraction accuracy, local market rates or authority compliance.",
              "No replacement for quantity surveyors, estimators, engineers or other responsible professionals.",
              "No blanket promise that every BOQ field or output has complete end-to-end source traceability.",
              "No voice or AI change is represented as professionally approved merely because software processed it.",
            ].map((boundary) => (
              <div key={boundary} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-slate-200">{boundary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-amber-200 bg-amber-50 px-4 py-10 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="container mx-auto flex max-w-5xl gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="mb-2 text-xl font-bold text-amber-950 dark:text-amber-100">Professional responsibility</h2>
            <p className="leading-relaxed text-amber-900/90 dark:text-amber-100/80">{PROFESSIONAL_REVIEW_NOTICE}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-20" aria-labelledby="faq-heading">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 id="faq-heading" className="mb-4 text-3xl font-bold">Quantara BOQ Software FAQs</h2>
            <p className="text-slate-600 dark:text-slate-400">{t("publicContent.home.directAnswers")}</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-slate-200 bg-white p-5 open:shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <summary className="cursor-pointer list-none pr-6 font-bold marker:hidden">{faq.question}</summary>
                <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 text-center">
        <div className="container mx-auto max-w-4xl rounded-3xl bg-blue-700 px-6 py-14 text-white">
          <Mic2 className="mx-auto mb-5 h-8 w-8" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold">Assess Quantara for Your UAE BOQ Workflow</h2>
          <p className="mx-auto mb-8 max-w-2xl text-blue-100">
            Share your source formats, measurement process, BOQ review requirements and output needs.
            We will confirm current capability and controlled-access dependencies.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact-sales" className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-6 font-semibold text-blue-800 hover:bg-blue-50">
              Discuss Requirements <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-300 px-6 font-semibold hover:bg-blue-600">
              {t("publicContent.cta.startAccountSetup")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
