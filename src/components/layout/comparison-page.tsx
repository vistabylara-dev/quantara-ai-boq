import React from "react";
import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PROFESSIONAL_REVIEW_NOTICE } from "@/lib/public-site/product-truth";
import {
  getPublicSearchPage,
  type PublicSearchPath,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

export interface ComparisonCriteria {
  label: string;
  approachAValue: string;
  approachBValue: string;
}

export interface ComparisonFAQ {
  question: string;
  answer: string;
}

export interface ComparisonPageProps {
  title: string;
  h1: string;
  directAnswer: string;
  approachAName: string;
  approachBName: string;
  whenToChooseA: string[];
  whenToChooseB: string[];
  whenToUseBoth: string[];
  approachADefinition: string;
  approachBDefinition: string;
  comparisonCriteria: ComparisonCriteria[];
  approachAStrengths: string[];
  approachALimitations: string[];
  approachBStrengths: string[];
  approachBLimitations: string[];
  workflowExample: string;
  quantaraRole: string;
  faqs: ComparisonFAQ[];
  relatedLinks: { url: string; label: string }[];
  breadcrumbCurrent: string;
  slug: string;
}

export function ComparisonPage(props: ComparisonPageProps) {
  const path = `/${props.slug}` as PublicSearchPath;
  const searchPage = getPublicSearchPage(path);
  const breadcrumbItems = [
    { name: "Home", item: "/" },
    { name: "Comparisons", item: "/comparisons" },
    { name: props.breadcrumbCurrent, item: path }
  ];

  const jsonLd = buildPublicPageGraph({
    path: searchPage.path,
    title: searchPage.title,
    description: searchPage.description,
    breadcrumbs: breadcrumbItems.map((item) => ({
      name: item.name,
      path: item.item,
    })),
    faqs: props.faqs,
  });

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">
      <PublicJsonLd data={jsonLd} />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20 mt-16">
        <PublicBreadcrumb items={breadcrumbItems} tone="light" />

        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {props.h1}
          </h1>
          <p className="mt-6 border-l-4 border-blue-600 bg-blue-50 px-5 py-4 text-lg leading-8 text-slate-700">
            {props.directAnswer}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            {PROFESSIONAL_REVIEW_NOTICE}
          </p>
        </header>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Quick Decision Summary</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Choose {props.approachAName} when:</h3>
              <ul className="space-y-2">
                {props.whenToChooseA.map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start">
                    <span className="text-blue-600 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Choose {props.approachBName} when:</h3>
              <ul className="space-y-2">
                {props.whenToChooseB.map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start">
                    <span className="text-blue-600 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-4">Use both together when:</h3>
              <ul className="space-y-2">
                {props.whenToUseBoth.map((item, i) => (
                  <li key={i} className="text-sm text-blue-800 flex items-start">
                    <span className="text-blue-600 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Defining the Approaches</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{props.approachAName}</h3>
              <p className="text-slate-600">{props.approachADefinition}</p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{props.approachBName}</h3>
              <p className="text-slate-600">{props.approachBDefinition}</p>
            </div>
          </div>
        </section>

        <section className="mb-16 overflow-x-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Capability Comparison</h2>
          <table className="w-full text-left border-collapse min-w-[600px]">
            <caption className="sr-only">
              Capability comparison between {props.approachAName} and {props.approachBName}
            </caption>
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-slate-900 w-1/3">Criteria</th>
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-slate-900 w-1/3 bg-slate-50">{props.approachAName}</th>
                <th scope="col" className="py-4 px-4 text-sm font-semibold text-slate-900 w-1/3 bg-slate-50">{props.approachBName}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {props.comparisonCriteria.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <th scope="row" className="py-4 px-4 text-sm font-medium text-slate-900">{c.label}</th>
                  <td className="py-4 px-4 text-sm text-slate-600">{c.approachAValue}</td>
                  <td className="py-4 px-4 text-sm text-slate-600">{c.approachBValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Strengths & Limitations</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <span className="text-green-600 mr-2">✓</span> {props.approachAName} Strengths
                </h3>
                <ul className="space-y-2">
                  {props.approachAStrengths.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start"><span className="text-slate-300 mr-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <span className="text-amber-600 mr-2">⚠</span> {props.approachAName} Limitations
                </h3>
                <ul className="space-y-2">
                  {props.approachALimitations.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start"><span className="text-slate-300 mr-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <span className="text-green-600 mr-2">✓</span> {props.approachBName} Strengths
                </h3>
                <ul className="space-y-2">
                  {props.approachBStrengths.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start"><span className="text-slate-300 mr-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <span className="text-amber-600 mr-2">⚠</span> {props.approachBName} Limitations
                </h3>
                <ul className="space-y-2">
                  {props.approachBLimitations.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start"><span className="text-slate-300 mr-2 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 bg-slate-50 p-8 rounded-2xl border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Practical Workflow Example</h2>
          <p className="text-slate-600 leading-relaxed mb-6">{props.workflowExample}</p>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">How Quantara Fits</h3>
          <p className="text-slate-600 leading-relaxed">{props.quantaraRole}</p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {props.faqs.map((faq, i) => (
              <div key={i} className="pb-6 border-b border-slate-100 last:border-0">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{faq.question}</h3>
                <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 p-6 border border-slate-200 rounded-xl">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Related Resources</h2>
          <ul className="flex flex-wrap gap-4">
            {props.relatedLinks.map((link, i) => (
              <li key={i}>
                <Link href={link.url} className="text-blue-600 hover:text-blue-800 font-medium underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-center bg-white border border-slate-200 rounded-2xl p-10 mb-16 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Organize Your Workflows?</h2>
          <p className="text-slate-600 max-w-2xl mx-auto mb-8">
            Explore how Quantara assists with supported document extraction, BOQ structuring, and project records.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact-sales" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">Contact Sales</Link>
            <Link href="/features" className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold transition-colors">Explore Features</Link>
          </div>
        </section>

        <section className="p-5 bg-slate-100 border border-slate-200 rounded-xl text-center max-w-4xl mx-auto">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            This comparison is provided for general workflow guidance. The appropriate process depends on project requirements, contractual obligations, available documents, internal controls and professional responsibilities. All quantities, units, descriptions, specifications, rates, assumptions, exclusions and generated outputs must be reviewed by appropriately qualified construction professionals before tender, procurement, contractual or construction use.
          </p>
        </section>
      </div>

      </div>
  );
}
