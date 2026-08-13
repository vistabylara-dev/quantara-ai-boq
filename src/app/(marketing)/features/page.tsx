import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, LockKeyhole, XCircle } from "lucide-react";

import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import {
  getPublicCapabilityRegisterEntries,
  getPublicCapabilityStatusForDisplay,
  getQuantaraProductTruthForDisplay,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";

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
  const publicCapabilities = getPublicCapabilityRegisterEntries(t);
  const productTruth = getQuantaraProductTruthForDisplay(t);
  const capabilityStatus = Object.fromEntries(
    (["AVAILABLE", "CONTROLLED_ACCESS", "LIMITED", "NOT_AVAILABLE"] as const).map(
      (status) => [status, getPublicCapabilityStatusForDisplay(status, t)],
    ),
  ) as Record<PublicCapabilityStatus, { label: string; description: string }>;

  return (
    <>
      <PublicPageJsonLd
        path="/features"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Features", path: "/features" }]}
      />
      <div className="min-h-screen bg-[#030508] text-white">
      <PublicBreadcrumb
        items={[
          { name: t("legal.shared.home"), item: "/" },
          { name: t("publicContent.features.breadcrumb"), item: "/features" },
        ]}
      />

      <section className="px-4 pb-14 pt-16">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
            {t("publicContent.features.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("publicContent.features.pageTitle")}
          </h1>
          <p className="mx-auto mb-5 max-w-3xl text-lg leading-relaxed text-slate-300">
            {t("publicContent.features.intro", {
              entityDefinition: productTruth.entityDefinition,
            })}
          </p>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-400">
            {productTruth.workflowTruth}
          </p>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/50 px-4 py-8">
        <div className="container mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(statusPresentation) as PublicCapabilityStatus[]).map((status) => {
            const presentation = statusPresentation[status];
            const Icon = presentation.icon;
            return (
              <div key={status} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
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
      </section>

      <section className="px-4 py-16" aria-labelledby="feature-register-heading">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <h2 id="feature-register-heading" className="mb-3 text-3xl font-bold">
              {t("publicContent.features.registerTitle")}
            </h2>
            <p className="leading-relaxed text-slate-400">
              {t("publicContent.features.truthNote")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {publicCapabilities.map((capability) => {
              const presentation = statusPresentation[capability.status];
              const Icon = presentation.icon;
              return (
                <article
                  key={capability.id}
                  id={capability.id}
                  className={`rounded-2xl border bg-slate-950 p-6 shadow-sm ${presentation.card}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold">{capability.name}</h3>
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
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-amber-900/60 bg-amber-950/20 px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <h2 className="mb-3 text-2xl font-bold text-amber-100">
            {t("publicContent.features.reviewTitle")}
          </h2>
          <p className="leading-relaxed text-amber-100/80">
            {productTruth.professionalReviewNotice}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 text-center">
        <div className="container mx-auto max-w-3xl rounded-3xl bg-slate-950 px-6 py-12 text-white dark:border dark:border-slate-800">
          <h2 className="mb-4 text-3xl font-bold">{t("publicContent.features.ctaTitle")}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-slate-300">
            {t("publicContent.features.ctaBody")}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact-sales" className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-semibold hover:bg-blue-500">
              {t("publicContent.features.discussRequirements")} <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-600 px-6 font-semibold hover:bg-slate-800">
              {t("publicContent.cta.startAccountSetup")}
            </Link>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
