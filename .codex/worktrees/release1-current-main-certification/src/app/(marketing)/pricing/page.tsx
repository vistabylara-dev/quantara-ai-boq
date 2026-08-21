import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { pricingTiers as tiers } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Pricing | Quantara AI BOQ Software",
  description: "Transparent pricing for Dubai and UAE project teams. Choose from Starter, Professional, Business or Enterprise tiers.",
  alternates: { canonical: "https://quantara.vistabylara.com/pricing" },
};

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://quantara.vistabylara.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Pricing",
        "item": "https://quantara.vistabylara.com/pricing"
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
              Transparent Pricing for Teams
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Choose the plan that best fits your project requirements. All plans are billed in AED.
            </p>
          </div>
          
          <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-4 lg:gap-x-8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-3xl p-8 ring-1 ${
                  tier.featured ? 'ring-blue-600 bg-white dark:bg-slate-900 shadow-xl' : 'ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <h3 className={`text-lg font-semibold leading-8 ${tier.featured ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                  {tier.name}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {tier.description}
                </p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{tier.price}</span>
                  <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">AED / mo</span>
                </p>
                <Link
                  href={tier.href}
                  className={`mt-6 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    tier.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
                  }`}
                >
                  Contact Sales
                </Link>
                <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {tier.features.map((feature) => (
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
