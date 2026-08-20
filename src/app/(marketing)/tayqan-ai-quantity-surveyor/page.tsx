import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
} from "lucide-react";

import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

export const metadata = createPublicPageMetadata("/tayqan-ai-quantity-surveyor");

const landingCopy = {
  en: {
    breadcrumb: "TAYQAN AI Quantity Surveyor",
    eyebrow: "Digital QS capacity inside Quantara",
    title: "Hire TAYQAN — Quantara's AI Quantity Surveyor",
    intro:
      "When you do not have time to carry every BOQ step yourself, TAYQAN can move supported project evidence through a governed Quantity Surveying workflow and prepare the work for your professional acceptance.",
    primaryCta: "Create account to hire TAYQAN",
    secondaryCta: "View hire options",
    assurance: "Human acceptance stays in control",
    directAnswerTitle: "What is TAYQAN?",
    directAnswer:
      "TAYQAN is Quantara's governed AI Quantity Surveyor / Digital QS workflow. It helps process supported project sources, review evidence, prepare quantities, assemble the BOQ and run final QA while keeping professional acceptance with the responsible human.",
    workflowEyebrow: "Governed workflow",
    workflowTitle: "From project sources to Ready for Acceptance",
    workflowBody:
      "TAYQAN works through controlled stages. Missing evidence stays visible; it is not silently fabricated to make the BOQ look complete.",
    workflow: [
      ["Source Discovery", "Identify the relevant supported project files and sources for the assignment."],
      ["Source Processing", "Process supported sources and surface usable project evidence for the BOQ workflow."],
      ["Evidence Review", "Review available evidence, source scope and unresolved issues before quantities are treated as ready."],
      ["Quantity Preparation", "Prepare quantities from supported reviewed evidence and measurement logic without inventing missing dimensions."],
      ["Rate Preparation", "Prepare rate inputs when requested and governed; missing commercial data is not silently fabricated."],
      ["BOQ Assembly", "Organize the working BOQ into reviewable sections and items with visible unresolved points."],
      ["Validation & Final QA", "Run governed checks across the assembled work before it is presented to the user."],
      ["Ready for Acceptance", "Present the result for human professional acceptance rather than automatic approval, issue or certification."],
    ],
    choiceEyebrow: "Choose how you work",
    choiceTitle: "Use Quantara directly — or add TAYQAN as Digital QS capacity",
    directTitle: "Work directly in Quantara",
    directBody:
      "Use the platform yourself for supported extraction, AI Draft BOQ, guided measurement, deterministic calculations, review, validation and outputs.",
    delegateTitle: "Hire TAYQAN",
    delegateBody:
      "Use the governed TAYQAN workflow when you want Digital QS capacity to carry supported BOQ work forward on your behalf while you retain final professional control.",
    boundariesEyebrow: "Professional control",
    boundariesTitle: "What TAYQAN will not do",
    boundaries: [
      "It does not automatically approve, issue, lock, certify or tender-submit a BOQ.",
      "It does not invent missing geometry, dimensions, quantities or rates.",
      "It does not claim fully unattended computer-vision takeoff from arbitrary drawing geometry.",
      "It does not replace the responsible Quantity Surveyor's professional judgement or acceptance.",
    ],
    audienceEyebrow: "Built for workload pressure",
    audienceTitle: "When TAYQAN can be useful",
    audiences: [
      ["QS teams", "Add governed capacity when several BOQ reviews or preparation tasks are competing for attention."],
      ["Contractors", "Move supported tender or project evidence through a structured BOQ workflow without handing control away."],
      ["MEP & fit-out teams", "Organize source-heavy BOQ work where schedules, evidence, measurements and revisions need controlled handling."],
      ["Small commercial teams", "Hire short-duration Digital QS capacity for a defined project workload instead of adding another permanent software operator."],
    ],
    pricingEyebrow: "Separate TAYQAN hire",
    pricingTitle: "Hire for a day, a week or monthly",
    pricingBody:
      "TAYQAN hire is commercially separate from the core Quantara SaaS subscription. Prices below come from the existing TAYQAN commerce configuration; this page does not create a second checkout system.",
    finalCtaTitle: "Need the BOQ work carried forward?",
    finalCtaBody:
      "Create your Quantara account, then use the authenticated TAYQAN hire journey for the package that matches your workload.",
    signIn: "Already have an account? Sign in",
    faqTitle: "TAYQAN questions",
  },
  ar: {
    breadcrumb: "TAYQAN مسّاح الكميات بالذكاء الاصطناعي",
    eyebrow: "قدرة مسّاح كميات رقمي داخل Quantara",
    title: "وظّف TAYQAN — مسّاح الكميات بالذكاء الاصطناعي من Quantara",
    intro:
      "عندما لا يتوفر لديك الوقت لتنفيذ كل مراحل BOQ بنفسك، يستطيع TAYQAN نقل أدلة المشروع المدعومة عبر سير عمل منضبط لحصر الكميات وتجهيز العمل للقبول المهني من جانبك.",
    primaryCta: "أنشئ حساباً لتوظيف TAYQAN",
    secondaryCta: "عرض خيارات التوظيف",
    assurance: "القبول البشري يبقى تحت سيطرتك",
    directAnswerTitle: "ما هو TAYQAN؟",
    directAnswer:
      "TAYQAN هو سير عمل Quantara المنضبط لمسّاح كميات بالذكاء الاصطناعي / مسّاح كميات رقمي. يساعد في معالجة مصادر المشروع المدعومة، ومراجعة الأدلة، وإعداد الكميات، وتجميع BOQ والمراجعة النهائية، مع بقاء القبول المهني لدى الإنسان المسؤول.",
    workflowEyebrow: "سير عمل منضبط",
    workflowTitle: "من مصادر المشروع إلى جاهز للقبول",
    workflowBody:
      "يعمل TAYQAN عبر مراحل محكومة. تبقى الأدلة الناقصة ظاهرة ولا يتم اختلاقها بصمت لجعل BOQ يبدو مكتملاً.",
    workflow: [
      ["اكتشاف المصادر", "تحديد ملفات ومصادر المشروع المدعومة ذات الصلة بالمهمة."],
      ["معالجة المصادر", "معالجة المصادر المدعومة وإظهار أدلة المشروع القابلة للاستخدام في سير عمل BOQ."],
      ["مراجعة الأدلة", "مراجعة الأدلة المتاحة ونطاق المصادر والنقاط غير المحسومة قبل اعتبار الكميات جاهزة."],
      ["إعداد الكميات", "إعداد الكميات من الأدلة المدعومة والمراجعة ومنطق القياس دون اختلاق أبعاد ناقصة."],
      ["إعداد الأسعار", "إعداد مدخلات الأسعار عند الطلب وضمن الضوابط، دون اختلاق بيانات تجارية ناقصة."],
      ["تجميع BOQ", "تنظيم BOQ العامل إلى أقسام وبنود قابلة للمراجعة مع إظهار النقاط غير المحسومة."],
      ["التحقق والمراجعة النهائية", "تشغيل فحوصات منضبطة على العمل المجمع قبل عرضه على المستخدم."],
      ["جاهز للقبول", "عرض النتيجة للقبول المهني البشري بدلاً من الاعتماد أو الإصدار أو التصديق التلقائي."],
    ],
    choiceEyebrow: "اختر طريقة العمل",
    choiceTitle: "استخدم Quantara مباشرة — أو أضف TAYQAN كقدرة مسّاح كميات رقمي",
    directTitle: "اعمل مباشرة داخل Quantara",
    directBody:
      "استخدم المنصة بنفسك للاستخراج المدعوم وAI Draft BOQ والقياس الموجّه والحسابات الحتمية والمراجعة والتحقق والمخرجات.",
    delegateTitle: "وظّف TAYQAN",
    delegateBody:
      "استخدم سير عمل TAYQAN المنضبط عندما تريد قدرة مسّاح كميات رقمي لدفع أعمال BOQ المدعومة إلى الأمام نيابةً عنك مع احتفاظك بالسيطرة المهنية النهائية.",
    boundariesEyebrow: "السيطرة المهنية",
    boundariesTitle: "ما الذي لن يفعله TAYQAN",
    boundaries: [
      "لا يعتمد أو يصدر أو يقفل أو يصادق أو يقدّم BOQ للعطاء تلقائياً.",
      "لا يختلق هندسة أو أبعاداً أو كميات أو أسعاراً مفقودة.",
      "لا يدّعي تنفيذ حصر كميات بصري غير مراقب بالكامل من أي رسم هندسي بشكل عام.",
      "لا يستبدل الحكم المهني أو القبول النهائي لمسّاح الكميات المسؤول.",
    ],
    audienceEyebrow: "مصمم لضغط العمل",
    audienceTitle: "متى يكون TAYQAN مفيداً",
    audiences: [
      ["فرق QS", "أضف قدرة منضبطة عندما تتنافس عدة مهام BOQ أو مراجعات على وقت الفريق."],
      ["المقاولون", "انقل أدلة العطاء أو المشروع المدعومة عبر سير عمل BOQ منظم دون التخلي عن السيطرة."],
      ["فرق MEP والـ Fit-Out", "نظم أعمال BOQ كثيفة المصادر عندما تحتاج الجداول والأدلة والقياسات والمراجعات إلى معالجة محكومة."],
      ["الفرق التجارية الصغيرة", "وظّف قدرة مسّاح كميات رقمي لمدة محددة لحجم عمل مشروع واضح بدلاً من إضافة مشغل دائم جديد."],
    ],
    pricingEyebrow: "توظيف TAYQAN منفصل",
    pricingTitle: "وظّفه ليوم أو أسبوع أو شهرياً",
    pricingBody:
      "توظيف TAYQAN منفصل تجارياً عن اشتراك Quantara الأساسي. الأسعار أدناه تأتي من إعدادات تجارة TAYQAN الحالية، وهذه الصفحة لا تنشئ نظام دفع ثانياً.",
    finalCtaTitle: "هل تريد دفع أعمال BOQ إلى الأمام؟",
    finalCtaBody:
      "أنشئ حساب Quantara ثم استخدم رحلة توظيف TAYQAN الموثقة للحزمة التي تناسب حجم العمل.",
    signIn: "لديك حساب بالفعل؟ سجّل الدخول",
    faqTitle: "أسئلة عن TAYQAN",
  },
} as const;

export default async function TayqanAiQuantitySurveyorPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const sales = getPublicSalesTruth(locale);
  const copy = landingCopy[locale];
  const searchPage = getPublicSearchPage("/tayqan-ai-quantity-surveyor");

  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: copy.breadcrumb, item: "/tayqan-ai-quantity-surveyor" },
  ];

  const faqs =
    locale === "ar"
      ? [
          {
            question: "ما هو TAYQAN؟",
            answer:
              "TAYQAN هو مسّاح كميات رقمي منضبط داخل Quantara يساعد في معالجة المصادر المدعومة ومراجعة الأدلة وإعداد الكميات وتجميع BOQ والمراجعة النهائية، مع بقاء القبول المهني تحت سيطرة الإنسان.",
          },
          {
            question: "هل يستبدل TAYQAN مسّاح الكميات؟",
            answer:
              "لا. يساعد TAYQAN في تنفيذ سير العمل ولكنه لا يستبدل الحكم المهني أو القبول النهائي أو المسؤولية المهنية لمسّاح الكميات.",
          },
          {
            question: "هل يقيس TAYQAN أي رسم تلقائياً بالكامل؟",
            answer:
              "لا. يستخدم TAYQAN معالجة المصادر المدعومة والأدلة والقياسات المراجعة المتاحة، ولا يدّعي حصر هندسة أي رسم بشكل بصري غير مراقب بالكامل ولا يختلق الأبعاد الناقصة.",
          },
          {
            question: "كم تبلغ تكلفة TAYQAN؟",
            answer:
              "خيارات التوظيف الحالية هي 299 درهماً لليوم لمدة 24 ساعة وحتى مشروعين مختلفين، و999 درهماً للأسبوع، و2,499 درهماً شهرياً.",
          },
          {
            question: "كيف أوظف TAYQAN؟",
            answer:
              "أنشئ حساب Quantara أو سجّل الدخول ثم استخدم رحلة توظيف TAYQAN الموثقة للحزمة المؤهلة. توظيف TAYQAN منفصل عن اشتراك Quantara الأساسي.",
          },
        ]
      : [
          {
            question: "What is TAYQAN?",
            answer:
              "TAYQAN is Quantara's governed AI Quantity Surveyor / Digital QS workflow for supported source processing, evidence review, quantity preparation, BOQ assembly and final QA, with professional acceptance remaining under human control.",
          },
          {
            question: "Does TAYQAN replace a Quantity Surveyor?",
            answer:
              "No. TAYQAN can carry supported workflow tasks forward, but it does not replace professional judgement, final acceptance or the responsible Quantity Surveyor's professional responsibility.",
          },
          {
            question: "Can TAYQAN automatically measure any drawing?",
            answer:
              "No. TAYQAN uses supported source processing and available reviewed evidence and measurements. It does not claim fully unattended arbitrary drawing-geometry takeoff and does not invent missing dimensions.",
          },
          {
            question: "How much does TAYQAN cost?",
            answer:
              "Current hire options are AED 299 for a 24-hour Day hire with up to 2 distinct projects, AED 999 for a Week hire, and AED 2,499 per month for ongoing Digital QS capacity.",
          },
          {
            question: "How do I hire TAYQAN?",
            answer:
              "Create or sign in to a Quantara account and continue through the authenticated TAYQAN hire journey for an eligible package. TAYQAN hire is commercially separate from the core Quantara SaaS subscription.",
          },
        ];

  const jsonLd = buildPublicPageGraph({
    path: searchPage.path,
    title: searchPage.title,
    description: searchPage.description,
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

      <section className="border-b border-slate-800 px-4 pb-20 pt-10">
        <div className="container mx-auto max-w-6xl">
          <PublicBreadcrumb items={breadcrumbItems} />

          <div className="mx-auto mt-12 max-w-4xl text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
              {copy.eyebrow}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {copy.intro}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-7 font-semibold text-white hover:bg-cyan-800"
              >
                {copy.primaryCta}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-7 font-semibold text-white hover:bg-slate-900"
              >
                {copy.secondaryCta}
              </Link>
            </div>

            <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {copy.assurance}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="container mx-auto max-w-4xl rounded-3xl border border-cyan-900/60 bg-cyan-950/20 p-8 sm:p-10">
          <h2 className="text-3xl font-bold">{copy.directAnswerTitle}</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            {copy.directAnswer}
          </p>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/70 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              {copy.workflowEyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">{copy.workflowTitle}</h2>
            <p className="mt-4 leading-relaxed text-slate-400">{copy.workflowBody}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {copy.workflow.map(([title, description], index) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-[#05080d] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-200">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-bold">{title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
              {copy.choiceEyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">{copy.choiceTitle}</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-900/70 bg-blue-950/20 p-8">
              <Calculator className="h-8 w-8 text-blue-300" aria-hidden="true" />
              <h3 className="mt-5 text-2xl font-bold">{copy.directTitle}</h3>
              <p className="mt-4 leading-relaxed text-slate-300">{copy.directBody}</p>
              <Link href="/features" className="mt-6 inline-flex items-center font-semibold text-blue-300 hover:text-blue-200">
                {sales.aiDraftCta}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>

            <article className="rounded-3xl border border-cyan-900/70 bg-cyan-950/20 p-8">
              <BriefcaseBusiness className="h-8 w-8 text-cyan-300" aria-hidden="true" />
              <h3 className="mt-5 text-2xl font-bold">{copy.delegateTitle}</h3>
              <p className="mt-4 leading-relaxed text-slate-300">{copy.delegateBody}</p>
              <Link href="/pricing" className="mt-6 inline-flex items-center font-semibold text-cyan-300 hover:text-cyan-200">
                {sales.tayqanCta}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/70 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
              {copy.boundariesEyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">{copy.boundariesTitle}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {copy.boundaries.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-800 bg-[#05080d] p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
              {copy.audienceEyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">{copy.audienceTitle}</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {copy.audiences.map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <FileSearch className="h-6 w-6 text-blue-300" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/70 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              {copy.pricingEyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">{copy.pricingTitle}</h2>
            <p className="mt-4 leading-relaxed text-slate-400">{copy.pricingBody}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {TAYQAN_HIRE_PLANS.map((plan) => {
              const planCopy = sales.tayqanPlans[plan.plan];
              const amount = `AED ${(plan.amountMinor / 100).toLocaleString("en-AE")}`;
              const cadence = plan.billingInterval === "MONTH" ? sales.perMonth : sales.oneTime;

              return (
                <article key={plan.plan} className="rounded-3xl border border-slate-800 bg-[#05080d] p-7">
                  <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                    {planCopy.badge}
                  </span>
                  <h3 className="mt-5 text-2xl font-bold">{planCopy.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{planCopy.bestFor}</p>
                  <div className="mt-6">
                    <span className="text-4xl font-extrabold">{amount}</span>
                    <span className="ms-2 text-sm text-slate-400">{cadence}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{planCopy.duration}</p>
                  {plan.maxDistinctProjects ? (
                    <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                      {sales.upToProjects.replace("{count}", String(plan.maxDistinctProjects))}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{copy.faqTitle}</h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-lg font-bold">{faq.question}</h3>
                <p className="mt-3 leading-relaxed text-slate-400">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20">
        <div className="container mx-auto max-w-4xl rounded-3xl border border-cyan-900/70 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-9 text-center sm:p-12">
          <CheckCircle2 className="mx-auto h-10 w-10 text-cyan-300" aria-hidden="true" />
          <h2 className="mt-5 text-3xl font-bold">{copy.finalCtaTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-300">{copy.finalCtaBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-7 font-semibold text-white hover:bg-cyan-800"
            >
              {copy.primaryCta}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-7 font-semibold text-white hover:bg-slate-900"
            >
              {copy.signIn}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
