import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  PlugZap,
  ShieldCheck,
} from "lucide-react";

import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import { PROVIDER_REGISTRY } from "@/lib/integrations/provider-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { getPublicFeatureSales } from "@/lib/public-site/feature-sales";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";

export const metadata = createPublicPageMetadata("/features");

export default async function FeaturesPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const featureSales = getPublicFeatureSales(locale);
  const sales = getPublicSalesTruth(locale);
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
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-7 font-semibold text-white hover:bg-cyan-500"
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
                  className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-6 font-semibold text-white hover:bg-cyan-500"
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
                    <div className="mt-1 text-xs text-slate-500">
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
                className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-6 font-semibold hover:bg-cyan-500"
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