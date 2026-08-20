import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";

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
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

export const metadata = createPublicPageMetadata("/boq-integrations");

const copy = {
  en: {
    breadcrumb: "Integrations",
    eyebrow: "Quantara integration ecosystem",
    title: "Connect Quantara with the software your construction team already uses",
    intro:
      "Explore Quantara integration pages across BIM, CAD, common data environments, cloud storage, construction management, structural engineering and estimating platforms.",
    body:
      "Each integration page explains where that application fits in a Quantara BOQ workflow — from project sources and evidence review to measurement, BOQ assembly, TAYQAN and professional outputs.",
    categoryIntro:
      "Browse every integration by construction-software category.",
    cardAction: "Explore integration",
    integrationCount: "Integrations",
    finalTitle: "Bring your project ecosystem into one BOQ workflow",
    finalBody:
      "Create a Quantara account, explore the feature set, or use TAYQAN when you want Digital QS capacity to move the work forward.",
    createAccount: "Create account",
    features: "View Quantara features",
  },
  ar: {
    breadcrumb: "التكاملات",
    eyebrow: "منظومة تكاملات Quantara",
    title: "اربط Quantara بالبرامج التي يستخدمها فريق البناء لديك",
    intro:
      "استكشف صفحات تكامل Quantara مع منصات BIM وCAD وبيئات البيانات المشتركة والتخزين السحابي وإدارة الإنشاءات والهندسة الإنشائية والتقدير.",
    body:
      "توضح كل صفحة تكامل مكان التطبيق داخل سير عمل Quantara لـ BOQ — من مصادر المشروع ومراجعة الأدلة إلى القياس وتجميع BOQ وTAYQAN والمخرجات المهنية.",
    categoryIntro:
      "تصفح جميع التكاملات حسب فئة برنامج البناء.",
    cardAction: "استكشف التكامل",
    integrationCount: "التكاملات",
    finalTitle: "اجمع منظومة مشروعك داخل سير عمل BOQ واحد",
    finalBody:
      "أنشئ حساب Quantara، واستكشف الميزات، أو استخدم TAYQAN عندما تحتاج قدرة مسّاح كميات رقمي لدفع العمل إلى الأمام.",
    createAccount: "إنشاء حساب",
    features: "عرض ميزات Quantara",
  },
} as const;

const ARABIC_INTEGRATION_CATEGORY_LABELS: typeof INTEGRATION_CATEGORY_LABELS = {
  BIM_CAD: "BIM وCAD",
  CONSTRUCTION_MANAGEMENT: "إدارة الإنشاءات",
  COMMON_DATA_ENVIRONMENTS: "بيئات البيانات المشتركة",
  DOCUMENTS_STORAGE: "المستندات والتخزين السحابي",
  ESTIMATING_COST: "التقدير والتكلفة",
  STRUCTURAL_ENGINEERING: "الهندسة الإنشائية",
  VISUALIZATION_RENDERING: "التصور والإظهار",
};

export default async function BoqIntegrationsPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const pageCopy = copy[locale];
  const searchPage = getPublicSearchPage("/boq-integrations");

  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: pageCopy.breadcrumb, item: "/boq-integrations" },
  ];

  const jsonLd = buildPublicPageGraph({
    path: searchPage.path,
    title: searchPage.title,
    description: searchPage.description,
    breadcrumbs: breadcrumbItems.map((item) => ({
      name: item.name,
      path: item.item,
    })),
  });

  const categoryLabels =
    locale === "ar"
      ? ARABIC_INTEGRATION_CATEGORY_LABELS
      : INTEGRATION_CATEGORY_LABELS;

  const categoryGroups = Object.entries(categoryLabels)
    .map(([category, label]) => ({
      category,
      label,
      providers: PROVIDER_REGISTRY.filter(
        (provider) => provider.category === category,
      ),
    }))
    .filter((group) => group.providers.length > 0);

  return (
    <div className="min-h-screen bg-[#030508] text-white">
      <PublicJsonLd data={jsonLd} />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <PublicBreadcrumb items={breadcrumbItems} />

        <header className="mx-auto mt-10 max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
            {pageCopy.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
            {pageCopy.title}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
            {pageCopy.intro}
          </p>
          <p className="mx-auto mt-4 max-w-3xl leading-relaxed text-slate-400">
            {pageCopy.body}
          </p>

          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 px-6 py-4">
            <PlugZap className="h-6 w-6 text-cyan-300" aria-hidden="true" />
            <span className="text-3xl font-extrabold">
              {PROVIDER_REGISTRY.length}
            </span>
            <span className="text-sm text-slate-400">
              {pageCopy.integrationCount}
            </span>
          </div>
        </header>

        <p className="mx-auto mt-16 max-w-3xl text-center text-slate-400">
          {pageCopy.categoryIntro}
        </p>

        <div className="mt-10 space-y-14">
          {categoryGroups.map((group) => (
            <section key={group.category}>
              <h2 className="text-2xl font-bold">{group.label}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.providers.map((provider) => (
                  <Link
                    key={provider.id}
                    href={`/boq-integrations/${provider.id}`}
                    className="group rounded-2xl border border-slate-800 bg-slate-950 p-6 hover:border-cyan-900 hover:bg-cyan-950/10"
                  >
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {provider.familyDisplayName}
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-white">
                      {provider.displayName}
                    </h3>
                    <div className="mt-5 inline-flex items-center text-sm font-semibold text-cyan-300">
                      {pageCopy.cardAction}
                      <ArrowRight
                        className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-20 rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center md:p-12">
          <h2 className="text-3xl font-bold">{pageCopy.finalTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            {pageCopy.finalBody}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-6 font-semibold text-white hover:bg-cyan-800"
            >
              {pageCopy.createAccount}
            </Link>
            <Link
              href="/features"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold text-white hover:bg-slate-900"
            >
              {pageCopy.features}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
