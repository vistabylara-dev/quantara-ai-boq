import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, LockKeyhole, XCircle } from "lucide-react";

import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import {
  PROFESSIONAL_REVIEW_NOTICE,
  PUBLIC_CAPABILITIES,
  PUBLIC_CAPABILITY_STATUS_DESCRIPTIONS,
  PUBLIC_CAPABILITY_STATUS_LABELS,
  QUANTARA_ENTITY_DEFINITION,
  QUANTARA_WORKFLOW_TRUTH,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/features");

const statusPresentation: Record<
  PublicCapabilityStatus,
  { icon: typeof CheckCircle2; badge: string; card: string }
> = {
  AVAILABLE: {
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    card: "border-emerald-200 dark:border-emerald-900/70",
  },
  CONTROLLED_ACCESS: {
    icon: LockKeyhole,
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    card: "border-blue-200 dark:border-blue-900/70",
  },
  LIMITED: {
    icon: Info,
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
    card: "border-amber-200 dark:border-amber-900/70",
  },
  NOT_AVAILABLE: {
    icon: XCircle,
    badge: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    card: "border-slate-300 dark:border-slate-700",
  },
};

export default function FeaturesPage() {
  return (
    <>
      <PublicPageJsonLd
        path="/features"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Features", path: "/features" }]}
      />
      <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <PublicBreadcrumb
        items={[
          { name: "Home", item: "/" },
          { name: "Features", item: "/features" },
        ]}
      />

      <section className="px-4 pb-14 pt-16">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
            Current capability register
          </p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            BOQ Workflow Features and Availability
          </h1>
          <p className="mx-auto mb-5 max-w-3xl text-lg leading-relaxed text-slate-700 dark:text-slate-300">
            {QUANTARA_ENTITY_DEFINITION} This page distinguishes available, controlled-access,
            limited and unavailable capabilities so construction teams can assess the product
            without relying on roadmap language.
          </p>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {QUANTARA_WORKFLOW_TRUTH}
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-8 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="container mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(PUBLIC_CAPABILITY_STATUS_LABELS) as PublicCapabilityStatus[]).map((status) => {
            const presentation = statusPresentation[status];
            const Icon = presentation.icon;
            return (
              <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {PUBLIC_CAPABILITY_STATUS_LABELS[status]}
                </div>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {PUBLIC_CAPABILITY_STATUS_DESCRIPTIONS[status]}
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
              Verified Public Capability Register
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-400">
              Statuses describe the public product truth as reviewed on 9 August 2026. Controlled
              access does not mean every account has the feature enabled. Limited capabilities
              should be read together with their stated boundary.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_CAPABILITIES.map((capability) => {
              const presentation = statusPresentation[capability.status];
              const Icon = presentation.icon;
              return (
                <article
                  key={capability.id}
                  id={capability.id}
                  className={`rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 ${presentation.card}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold">{capability.name}</h3>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${presentation.badge}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {PUBLIC_CAPABILITY_STATUS_LABELS[capability.status]}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {capability.summary}
                  </p>
                  {capability.limitation ? (
                    <p className="mt-4 border-l-2 border-slate-300 pl-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
                      <strong>Boundary:</strong> {capability.limitation}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-amber-200 bg-amber-50 px-4 py-10 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="mb-3 text-2xl font-bold text-amber-950 dark:text-amber-100">
            Professional review remains mandatory
          </h2>
          <p className="leading-relaxed text-amber-900/90 dark:text-amber-100/80">
            {PROFESSIONAL_REVIEW_NOTICE}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 text-center">
        <div className="container mx-auto max-w-3xl rounded-3xl bg-slate-950 px-6 py-12 text-white dark:border dark:border-slate-800">
          <h2 className="mb-4 text-3xl font-bold">Discuss a Supported Quantara Workflow</h2>
          <p className="mx-auto mb-8 max-w-2xl text-slate-300">
            Tell us about your project sources, BOQ process and review requirements. We will confirm
            current fit and controlled-access dependencies before access is discussed.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/contact-sales" className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-semibold hover:bg-blue-500">
              Discuss Your Requirements <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-600 px-6 font-semibold hover:bg-slate-800">
              Request Early Access
            </Link>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
