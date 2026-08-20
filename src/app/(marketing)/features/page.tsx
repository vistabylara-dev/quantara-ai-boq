import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Layers3,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import { PROVIDER_REGISTRY } from "@/lib/integrations/provider-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  getPublicCapabilityRegisterEntries,
  getPublicCapabilityStatusForDisplay,
  getQuantaraProductTruthForDisplay,
  PUBLIC_CAPABILITY_EVIDENCE_LABELS,
  PUBLIC_CAPABILITY_REVIEW_DATE,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { getPublicFeatureSales } from "@/lib/public-site/feature-sales";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";

export const metadata = createPublicPageMetadata("/features");

const statusPresentation: Record<
  PublicCapabilityStatus,
  { icon: typeof CheckCircle2; badge: string; card: string }
> = {
  AVAILABLE: {
    icon: CheckCircle2,
    badge: "bg-emerald-950 text-emerald-200",
    card: "border-emerald-900/70",
  },
  CONTROLLED_ACCESS: {
    icon: LockKeyhole,
    badge: "bg-blue-950 text-blue-200",
    card: "border-blue-900/70",
  },
  LIMITED: {
    icon: Info,
    badge: "bg-amber-950 text-amber-100",
    card: "border-amber-900/70",
  },
  NOT_AVAILABLE: {
    icon: XCircle,
    badge: "bg-slate-800 text-slate-200",
    card: "border-slate-700",
  },
};

export default async function FeaturesPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const featureSales = getPublicFeatureSales(locale);
  const sales = getPublicSalesTruth(locale);
  const capabilities = getPublicCapabilityRegisterEntries(t);
  const capabilityStatus = Object.fromEntries(
    (["AVAILABLE", "CONTROLLED_ACCESS", "LIMITED", "NOT_AVAILABLE"] as const).map(
      (status) => [status, getPublicCapabilityStatusForDisplay(status, t)],
    ),
  ) as Record<PublicCapabilityStatus, { label: string; description: string }>;
  const productTruth = getQuantaraProductTruthForDisplay(t);
  const registerCopy = locale === "ar"
    ? {
        compare: "قارن برامج جداول الكميات في الإمارات",
        evidence: "الدليل:",
        dependsOn: "يعتمد على:",
        reviewed: "تمت المراجعة:",
        reviewLead: "تمت مراجعة أدلة المصدر والاختبارات بتاريخ",
        reviewBoundary:
          "لا تثبت هذه المراجعة وحدها النشر في بيئة الإنتاج أو استحقاق الحساب. اقرأ البنود الخاضعة للتحكم والمحدودة مع تبعياتها وحدودها المعلنة.",
      }
    : {
        compare: "Compare UAE BOQ software",
        evidence: "Evidence:",
        dependsOn: "Depends on:",
        reviewed: "Reviewed:",
        reviewLead: "Source-and-test evidence was reviewed on",
        reviewBoundary:
          "This review does not by itself establish production deployment or account entitlement. Read controlled-access and limited entries with their stated dependencies and boundaries.",
      };
  const evidenceLabels = locale === "ar"
    ? {
        SOURCE_REVIEWED: "تمت مراجعة المصدر",
        SOURCE_AND_TESTS_REVIEWED: "تمت مراجعة المصدر والاختبارات",
      }
    : PUBLIC_CAPABILITY_EVIDENCE_LABELS;
  const featureCount = featureSales.groups.reduce(
    (total, group) => total + group.features.length,
    0,
  );
  const featuredIntegrations = PROVIDER_REGISTRY.slice(0, 12);

  return (
    <>
      <PublicPageJsonLd
        path="/features"
        breadcrumbs={[
          { name: t("legal.shared.home"), path: "/" },
          { name: t("publicContent.features.breadcrumb"), path: "/features" },
        ]}
      />

      <div className="min-h-screen bg-[#030508] text-white">
        <PublicBreadcrumb
          items={[
            { name: t("legal.shared.home"), item: "/" },
            { name: t("publicContent.features.breadcrumb"), item: "/features" },
          ]}
        />

        <section className="px-4 pb-16 pt-16">
          <div className="container mx-auto max-w-5xl text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
              {featureSales.eyebrow}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              {featureSales.title}
            </h1>
            <p className="mx-auto mt-7 max-w-4xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {featureSales.intro}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-7 font-semibold text-white hover:bg-cyan-800"
              >
                {featureSales.createAccount}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-7 font-semibold text-white hover:bg-slate-900"
              >
                {featureSales.viewPricing}
              </Link>
            </div>

            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="text-3xl font-extrabold text-cyan-300">
                  {featureCount}+
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {featureSales.featureCountLabel}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="text-3xl font-extrabold text-cyan-300">
                  {PROVIDER_REGISTRY.length}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {featureSales.integrationCountLabel}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="text-3xl font-extrabold text-cyan-300">2</div>
                <div className="mt-1 text-sm text-slate-400">
                  {sales.twoWaysEyebrow}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="border-y border-slate-800 bg-slate-900/40 px-4 py-16"
          aria-labelledby="current-workflow-heading"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
                {sales.featureSpotlightEyebrow}
              </p>
              <h2
                id="current-workflow-heading"
                className="mb-4 text-3xl font-bold sm:text-4xl"
              >
                {sales.featureSpotlightTitle}
              </h2>
              <p className="leading-relaxed text-slate-400">
                {sales.featureSpotlightBody}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-blue-900/70 bg-slate-950 p-8">
                <Layers3 className="h-8 w-8 text-blue-300" aria-hidden="true" />
                <h3 className="mb-3 mt-5 text-2xl font-bold">
                  {sales.aiDraftTitle}
                </h3>
                <p className="mb-6 leading-relaxed text-slate-300">
                  {sales.aiDraftBody}
                </p>
                <ul className="space-y-3">
                  {sales.aiDraftBullets.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-relaxed text-slate-300"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-3xl border border-cyan-900/70 bg-slate-950 p-8">
                <ShieldCheck
                  className="h-8 w-8 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="mb-3 mt-5 text-2xl font-bold">
                  {sales.tayqanTitle}
                </h3>
                <p className="mb-6 leading-relaxed text-slate-300">
                  {sales.tayqanBody}
                </p>
                <ul className="mb-7 space-y-3">
                  {sales.tayqanBullets.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-relaxed text-slate-300"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/tayqan-ai-quantity-surveyor"
                  className="inline-flex items-center font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {sales.tayqanCta}
                  <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="container mx-auto max-w-6xl space-y-16">
            {featureSales.groups.map((group) => (
              <section key={group.title}>
                <div className="mb-8 max-w-3xl">
                  <h2 className="text-3xl font-bold">{group.title}</h2>
                  <p className="mt-3 leading-relaxed text-slate-400">
                    {group.body}
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {group.features.map(([name, description]) => (
                    <article
                      key={name}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                    >
                      <CheckCircle2
                        className="h-5 w-5 text-emerald-300"
                        aria-hidden="true"
                      />
                      <h3 className="mt-4 text-lg font-bold">{name}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400">
                        {description}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section
          className="border-y border-slate-800 bg-slate-900/40 px-4 py-20"
          aria-labelledby="feature-register-heading"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="mb-10 max-w-4xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
                {t("publicContent.features.eyebrow")}
              </p>
              <h2 id="feature-register-heading" className="mb-4 text-3xl font-bold sm:text-4xl">
                {t("publicContent.features.registerTitle")}
              </h2>
              <p className="leading-relaxed text-slate-300">
                {t("publicContent.features.intro", {
                  entityDefinition: productTruth.entityDefinition,
                })}
              </p>
              <p className="mt-4 leading-relaxed text-slate-400">
                {productTruth.workflowTruth}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                {registerCopy.reviewLead}{" "}
                <time dateTime={PUBLIC_CAPABILITY_REVIEW_DATE}>{PUBLIC_CAPABILITY_REVIEW_DATE}</time>.
                {" "}{registerCopy.reviewBoundary}
              </p>
              <Link
                href="/boq-software-comparison-uae"
                className="mt-5 inline-flex items-center font-semibold text-blue-300 hover:text-blue-200"
              >
                {registerCopy.compare}
                <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["AVAILABLE", "CONTROLLED_ACCESS", "LIMITED", "NOT_AVAILABLE"] as const).map((status) => {
                const presentation = statusPresentation[status];
                const Icon = presentation.icon;
                return (
                  <div key={status} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-white">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {capabilityStatus[status].label}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {capabilityStatus[status].description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => {
                const presentation = statusPresentation[capability.status];
                const Icon = presentation.icon;
                return (
                  <article
                    key={capability.id}
                    id={capability.id}
                    className={`rounded-2xl border bg-slate-950 p-6 ${presentation.card}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-bold text-white">{capability.name}</h3>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${presentation.badge}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {capabilityStatus[capability.status].label}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {capability.summary}
                    </p>
                    {capability.limitation ? (
                      <p className="mt-4 border-s-2 border-slate-700 ps-3 text-sm leading-relaxed text-slate-400">
                        <strong>{t("publicContent.features.boundaryLabel")}</strong> {capability.limitation}
                      </p>
                    ) : null}
                    {capability.evidenceLevel || capability.dependencies?.length || capability.reviewedAt ? (
                      <dl className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
                        {capability.evidenceLevel ? (
                          <div className="flex flex-wrap gap-x-1">
                            <dt className="font-semibold">{registerCopy.evidence}</dt>
                            <dd>{evidenceLabels[capability.evidenceLevel]}</dd>
                          </div>
                        ) : null}
                        {capability.dependencies?.length ? (
                          <div className="flex flex-wrap gap-x-1">
                            <dt className="font-semibold">{registerCopy.dependsOn}</dt>
                            <dd>{capability.dependencies.join("; ")}</dd>
                          </div>
                        ) : null}
                        {capability.reviewedAt ? (
                          <div className="flex flex-wrap gap-x-1">
                            <dt className="font-semibold">{registerCopy.reviewed}</dt>
                            <dd>
                              <time dateTime={capability.reviewedAt}>{capability.reviewedAt}</time>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950 px-4 py-20">
          <div className="container mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <PlugZap className="h-9 w-9 text-cyan-300" aria-hidden="true" />
                <h2 className="mt-5 text-3xl font-bold">
                  {featureSales.integrationTitle}
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  {featureSales.integrationBody}
                </p>
                <Link
                  href="/boq-integrations"
                  className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-6 font-semibold text-white hover:bg-cyan-800"
                >
                  {featureSales.integrationCta}
                  <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {featuredIntegrations.map((provider) => (
                  <Link
                    key={provider.id}
                    href={`/boq-integrations/${provider.id}`}
                    className="rounded-xl border border-slate-800 bg-[#05080d] px-5 py-4 hover:border-cyan-900 hover:bg-cyan-950/10"
                  >
                    <div className="font-semibold text-white">
                      {provider.displayName}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {provider.familyDisplayName}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-amber-900/60 bg-amber-950/20 px-4 py-12">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-amber-100">
              {featureSales.controlTitle}
            </h2>
            <p className="mt-3 leading-relaxed text-amber-100/80">
              {featureSales.controlBody}
            </p>
          </div>
        </section>

        <section className="px-4 py-20 text-center">
          <div className="container mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 px-6 py-12">
            <h2 className="text-3xl font-bold">{featureSales.ctaTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              {featureSales.ctaBody}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-700 px-6 font-semibold hover:bg-cyan-800"
              >
                {featureSales.createAccount}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold hover:bg-slate-900"
              >
                {featureSales.viewPricing}
              </Link>
              <Link
                href="/tayqan-ai-quantity-surveyor"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-6 font-semibold hover:bg-slate-900"
              >
                {featureSales.exploreTayqan}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
