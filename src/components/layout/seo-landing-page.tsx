"use client";

import React, { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, CheckCircle2, FileText, Settings, ShieldCheck, ArrowRight, Zap, FolderKanban } from "lucide-react";
import PublicBreadcrumb, { generateBreadcrumbSchema } from "@/components/ui/public-breadcrumb";

export type FeatureStatus = "Live" | "Preview UI" | "In Development" | "Planned";

export interface SeoLandingPageContent {
  breadcrumbLabel: string;
  h1: string;
  directDefinition: string;
  audience: {
    heading: string;
    content: string;
    items?: string[];
  };
  workflowProblem: {
    heading: string;
    paragraphs: (string | ReactNode)[];
    items?: string[];
  };
  quantaraSupport: {
    heading: string;
    paragraphs: (string | ReactNode)[];
  };
  relevantFeatures: Array<{
    name: string;
    status: FeatureStatus;
    description: string;
  }>;
  workflowExample: {
    heading: string;
    introduction: string;
    steps: Array<{
      title: string;
      description: string;
    }>;
  };
  supportedInputs: Array<{
    name: string;
    status: FeatureStatus;
    description: string;
    limitation?: string;
  }>;
  supportedOutputs: Array<{
    name: string;
    status: FeatureStatus;
    description: string;
  }>;
  limitations: string[];
  faqs: Array<{
    question: string;
    answer: string | ReactNode;
    schemaAnswer?: string;
  }>;
  relatedPages: Array<{
    href: string;
    label: string;
    description: string;
  }>;
}

const statusColors = {
  "Live": "bg-green-500",
  "Preview UI": "bg-amber-400",
  "In Development": "bg-amber-500 animate-pulse",
  "Planned": "bg-slate-300 dark:bg-slate-700",
};

export default function SeoLandingPage({ content, currentPath }: { content: SeoLandingPageContent; currentPath: string }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100">
      <div className="flex-1 pb-24">
        {/* Breadcrumb */}
        <div className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/50 py-4 px-4">
          <div className="container mx-auto max-w-4xl text-sm font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="text-slate-900 dark:text-slate-200">{content.breadcrumbLabel}</span>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 pt-16 pb-12">
          {/* Hero Section */}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white leading-tight">
            {content.h1}
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed font-medium mb-16">
            {content.directDefinition}
          </p>

          <div className="space-y-16">
            {/* Who is it for */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.audience.heading}</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {content.audience.content}
              </p>
              {content.audience.items && (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                  {content.audience.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Workflow Problem */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.workflowProblem.heading}</h2>
              <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {content.workflowProblem.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              {content.workflowProblem.items && (
                <ul className="mt-6 space-y-3">
                  {content.workflowProblem.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* How Quantara Supports */}
            <section>
              <h2 className="text-2xl font-bold mb-4">{content.quantaraSupport.heading}</h2>
              <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {content.quantaraSupport.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </section>

            {/* Relevant Features */}
            <section>
              <h2 className="text-2xl font-bold mb-6">Relevant Features</h2>
              <div className="grid gap-6">
                {content.relevantFeatures.map((f, idx) => (
                  <div key={idx} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{f.name}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${statusColors[f.status]}`} />
                      {f.status}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Practical Workflow Example */}
            <section className="bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-8 border border-blue-100 dark:border-blue-900/30">
              <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{content.workflowExample.heading}</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">{content.workflowExample.introduction}</p>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-200 dark:before:via-blue-800 before:to-transparent">
                {content.workflowExample.steps.map((step, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#030508] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                      <span className="font-bold text-sm">{idx + 1}</span>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Inputs & Outputs Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h2 className="text-2xl font-bold mb-6">Supported Inputs</h2>
                <div className="space-y-4">
                  {content.supportedInputs.map((input, idx) => (
                    <div key={idx} className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{input.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          input.status === 'Live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {input.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{input.description}</p>
                      {input.limitation && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">Note: {input.limitation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-6">Supported Outputs</h2>
                <div className="space-y-4">
                  {content.supportedOutputs.map((output, idx) => (
                    <div key={idx} className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{output.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          output.status === 'Live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {output.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{output.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Limitations */}
            <section className="bg-slate-50 dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h2 className="text-2xl font-bold mb-4">Current Limitations</h2>
              <ul className="space-y-3">
                {content.limitations.map((limit, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0 mt-2.5" />
                    <span className="leading-relaxed">{limit}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Professional Disclaimer */}
            <section className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-r-xl">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">Professional Disclaimer</h3>
              <p className="text-amber-700 dark:text-amber-400/90 text-sm leading-relaxed">
                Quantara assists with document extraction, BOQ organization, project records, templates and supported document-generation workflows. All extracted information, quantities, units, specifications, rates, assumptions, exclusions and generated documents must be reviewed by a qualified estimator, quantity surveyor, engineer or responsible project professional before tender, procurement, contractual or construction use.
              </p>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
              <div className="max-w-3xl mx-auto space-y-4">
                {content.faqs.map((faq, index) => (
                  <div key={index} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                      aria-expanded={openFaq === index}
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100 pr-4">{faq.question}</span>
                      <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-200 shrink-0 ${openFaq === index ? "rotate-180" : ""}`} />
                    </button>
                    <div
                      className={`px-6 overflow-hidden transition-all duration-200 ease-in-out ${
                        openFaq === index ? "max-h-96 pb-4 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Related Pages */}
            <section className="border-t border-slate-200 dark:border-slate-800 pt-16">
              <h2 className="text-2xl font-bold mb-6">Related Resources</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.relatedPages.map((page, idx) => (
                  <Link key={idx} href={page.href} className="group p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors block">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{page.label}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{page.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-blue-600 mt-auto">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Ready to streamline your BOQ workflows?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg text-base font-bold bg-white text-blue-700 hover:bg-slate-50 h-14 px-8 py-4 shadow-lg w-full sm:w-auto">
              Request Early Access
            </Link>
            <Link href="/features" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-blue-400 bg-transparent text-white hover:bg-blue-700 h-14 px-8 py-4 w-full sm:w-auto">
              Explore Features
            </Link>
          </div>
        </div>
      </section>

      </div>
  );
}
