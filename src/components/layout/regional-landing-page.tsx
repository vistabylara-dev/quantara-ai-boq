import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertTriangle, MapPin } from "lucide-react";
import PublicFooter from "@/components/layout/public-footer";
import PublicHeader from "@/components/layout/public-header";
import PublicBreadcrumb, { generateBreadcrumbSchema } from "@/components/ui/public-breadcrumb";

export interface RegionalFAQ {
  question: string;
  answer: string;
}

export interface RegionalLandingPageContent {
  breadcrumbLabel: string;
  breadcrumbParent: { label: string; href: string };
  title: string;
  audienceDescription: string;
  directAnswer: string;
  challenges: {
    title: string;
    description: string;
  }[];
  workflowDescription: string;
  workflowExample: string;
  typicalCategories: string[];
  supportedInputs: string[];
  plannedInputs: string[];
  supportedOutputs: string[];
  limitations: string[];
  faqs: RegionalFAQ[];
  relatedPages: { label: string; href: string }[];
  schema: any;
}

export default function RegionalLandingPage({ content }: { content: RegionalLandingPageContent }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      <PublicHeader />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-12 md:py-16 bg-white shadow-sm border-x border-slate-200">
        
        <div className="px-4 md:px-8">
          <PublicBreadcrumb items={[
            { name: "Home", item: "/" },
            { name: "Regional", item: "/gcc-boq-software" },
            { name: content.breadcrumbLabel }
          ]} />
        </div>

        <header className="mb-14 px-4 md:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
            <MapPin className="w-3 h-3" /> Regional Workflow
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            {content.title}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8 max-w-3xl">
            {content.audienceDescription}
          </p>
          <div className="p-6 bg-slate-50 border-l-4 border-blue-600 rounded-r-xl">
            <p className="font-medium text-slate-800 leading-relaxed">{content.directAnswer}</p>
          </div>
        </header>

        <section className="mb-16 px-4 md:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
            Regional Workflow Challenges
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {content.challenges.map((challenge, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg mb-3 text-slate-800">{challenge.title}</h3>
                <p className="text-slate-600 leading-relaxed">{challenge.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 px-4 md:px-8">
          <div className="bg-slate-900 rounded-2xl p-8 md:p-12 text-white">
            <h2 className="text-2xl font-bold mb-6">How Quantara Supports the Workflow</h2>
            <p className="text-slate-300 leading-relaxed mb-8 text-lg">{content.workflowDescription}</p>
            
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-400">
                <ArrowRight className="w-5 h-5" /> Regional Scenario
              </h3>
              <p className="text-slate-300 leading-relaxed italic">&quot;{content.workflowExample}&quot;</p>
            </div>
          </div>
        </section>

        <section className="mb-16 px-4 md:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 pb-4 border-b border-slate-100">Capabilities and Scope</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Inputs
              </h3>
              <ul className="space-y-3 text-sm text-slate-600 mb-6">
                {content.supportedInputs.map((input, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span> 
                    <span>{input}</span>
                  </li>
                ))}
              </ul>
              
              <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Planned Integration</h4>
              <ul className="space-y-2 text-sm text-slate-500 opacity-75">
                {content.plannedInputs.map((input, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {input}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Structuring
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                {content.typicalCategories.map((cat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span> 
                    <span>{cat}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-4 italic">No pre-built regional libraries or code-compliance categories are currently enforced.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Outputs
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                {content.supportedOutputs.map((output, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span> 
                    <span>{output}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16 px-4 md:px-8">
          <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
            <h2 className="text-xl font-bold text-amber-900 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" /> Professional Disclaimer & Limitations
            </h2>
            <ul className="space-y-3 text-sm text-amber-800 mb-8 list-disc pl-6 font-medium">
              {content.limitations.map((limitation, idx) => (
                <li key={idx} className="leading-relaxed">{limitation}</li>
              ))}
            </ul>
            <div className="p-5 bg-white/60 border border-amber-100 rounded-xl">
              <p className="text-sm text-amber-950 font-semibold leading-relaxed">
                Quantara assists with supported document extraction, BOQ organization, project records, templates, revisions and document-generation workflows. Regional project requirements, contractual obligations, measurement methods, rates, tax treatment, regulations and professional responsibilities vary. All quantities, units, descriptions, specifications, rates, assumptions, exclusions and generated outputs must be reviewed by appropriately qualified local construction professionals before tender, procurement, contractual or construction use.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16 px-4 md:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6">
            {content.faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-6 rounded-xl hover:border-slate-300 transition-colors">
                <h3 className="font-semibold text-slate-900 mb-3 text-lg">{faq.question}</h3>
                <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 px-4 md:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-100">Related Resources</h2>
          <div className="flex flex-wrap gap-3">
            {content.relatedPages.map((page, idx) => (
              <Link key={idx} href={page.href} className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm">
                {page.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="text-center py-16 px-4 md:px-8 bg-blue-900 text-white rounded-3xl mb-8 mx-4 md:mx-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-800 rounded-full blur-3xl opacity-50 transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-800 rounded-full blur-3xl opacity-50 transform -translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Start Structuring Your BOQ Workflows</h2>
            <p className="text-blue-100 mb-10 text-lg">Organize project documents, tender revisions, and proposal outputs in one unified platform.</p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                Request Early Access
              </Link>
              <Link href="/features" className="w-full sm:w-auto px-8 py-4 bg-blue-800 text-white border border-blue-700 font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Explore Features
              </Link>
              <Link href="/contact-sales" className="w-full sm:w-auto px-8 py-4 bg-transparent text-white border border-blue-400 font-semibold rounded-xl hover:bg-blue-800 transition-colors">
                Contact Sales
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(content.schema) }}
      />
    </div>
  );
}
