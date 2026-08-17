import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Layers3,
} from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { getPublicSalesTruth } from "@/lib/public-site/sales-truth";

type PublicBuyerJourneyProps = {
  locale: Locale;
  startAccountLabel: string;
};

export default function PublicBuyerJourney({
  locale,
  startAccountLabel,
}: PublicBuyerJourneyProps) {
  const sales = getPublicSalesTruth(locale);

  return (
    <section
      aria-labelledby="quantara-buyer-journey-heading"
      className="overflow-hidden rounded-3xl border border-slate-800 bg-[#030508] p-7 text-white shadow-xl md:p-10"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
          {sales.twoWaysEyebrow}
        </p>
        <h2
          id="quantara-buyer-journey-heading"
          className="text-3xl font-bold tracking-tight md:text-4xl"
        >
          {sales.twoWaysTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-300">
          {sales.twoWaysBody}
        </p>
        <p className="mt-6 inline-flex rounded-full border border-cyan-900/60 bg-cyan-950/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
          {sales.heroSignal}
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-blue-900/70 bg-blue-950/20 p-6 md:p-7">
          <Layers3 className="h-7 w-7 text-blue-300" aria-hidden="true" />
          <h3 className="mt-4 text-2xl font-bold">{sales.aiDraftTitle}</h3>
          <p className="mt-3 leading-relaxed text-slate-300">
            {sales.aiDraftBody}
          </p>

          <ul className="mt-6 space-y-3">
            {sales.aiDraftBullets.slice(0, 5).map((item) => (
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

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {startAccountLabel}
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/features"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              {sales.aiDraftCta}
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-900/70 bg-cyan-950/20 p-6 md:p-7">
          <BriefcaseBusiness
            className="h-7 w-7 text-cyan-300"
            aria-hidden="true"
          />
          <h3 className="mt-4 text-2xl font-bold">{sales.tayqanTitle}</h3>
          <p className="mt-3 leading-relaxed text-slate-300">
            {sales.tayqanBody}
          </p>

          <ul className="mt-6 space-y-3">
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

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/tayqan-ai-quantity-surveyor"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              {sales.tayqanCta}
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              {sales.viewPricing}
            </Link>
          </div>
        </article>
      </div>

      <p className="mt-8 text-center text-sm font-medium text-slate-400">
        {sales.professionalAcceptance}
      </p>
    </section>
  );
}