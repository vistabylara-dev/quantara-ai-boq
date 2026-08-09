import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { publicAccessOptions as accessOptions } from "@/config/pricing";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

export const metadata = createPublicPageMetadata("/pricing");

const searchEntry = getPublicSearchPage("/pricing");
const pageSchema = buildPublicPageGraph({
  path: "/pricing",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "Pricing", path: "/pricing" },
  ],
});

export default function PricingPage() {
  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="bg-slate-50 dark:bg-slate-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          
          <nav className="mb-12 text-sm" aria-label="Breadcrumb">
            <ol className="flex items-center justify-center space-x-2 text-slate-500">
              <li>
                <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-900 font-medium" aria-current="page">Pricing</li>
            </ol>
          </nav>
          
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Quantara Access and Commercial Terms
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Quantara does not currently offer public self-service subscription plans or checkout. Access, supported features, implementation scope and any commercial terms are reviewed and confirmed separately in writing.
            </p>
          </div>
          
          <div className="isolate mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 sm:mt-20 lg:grid-cols-2">
            {accessOptions.map((option) => (
              <div
                key={option.name}
                className={`rounded-3xl p-8 ring-1 ${
                  option.featured ? 'ring-blue-600 bg-white dark:bg-slate-900 shadow-xl' : 'ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <h3 className={`text-lg font-semibold leading-8 ${option.featured ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                  {option.name}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {option.description}
                </p>
                <p className="mt-6 text-base font-semibold text-slate-900 dark:text-white">
                  {option.commercialTerms}
                </p>
                <Link
                  href={option.href}
                  className={`mt-6 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    option.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
                  }`}
                >
                  {option.ctaLabel}
                </Link>
                <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckCircle2 className="h-6 w-5 flex-none text-blue-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
