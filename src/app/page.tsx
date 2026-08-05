import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, LayoutTemplate, BoxSelect, FolderKanban, ShieldCheck, Database } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quantara AI BOQ and Construction Estimating Platform",
  description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
  openGraph: {
    title: "Quantara AI BOQ and Construction Estimating Platform",
    description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
    url: "https://quantara.local",
    siteName: "Quantara",
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2" aria-label="Quantara Home">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </span>
            Quantara
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Features</Link>
            <Link href="/contact-sales" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Contact Sales</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Sign In</Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2">
              Request Early Access
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
            Create professional BOQs faster with AI-assisted extraction, structured estimating, and controlled project data
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Quantara helps construction, fit-out, MEP, facilities-management, and contracting teams turn project documents into organized BOQ workflows. Extract scope information, structure items, manage quantities and pricing, apply approved templates, and generate professional project documents from one controlled workspace.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg text-base font-medium bg-blue-600 text-white hover:bg-blue-700 h-12 px-8 py-3 w-full sm:w-auto shadow-sm">
              Request Early Access <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link href="/features" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 h-12 px-8 py-3 w-full sm:w-auto">
              Explore the Features
            </Link>
            <Link href="/contact-sales" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 h-12 px-8 py-3 w-full sm:w-auto">
              Contact Sales
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Structured BOQ workflows</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Project-based access controls</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Controlled templates</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Professional document generation</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Built for construction and project teams</div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl bg-white dark:bg-slate-950 p-2 md:p-4">
            <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-col relative overflow-hidden">
               <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
               <div className="z-10 text-center">
                 <BoxSelect className="h-16 w-16 mx-auto text-blue-600 mb-4 opacity-80" />
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Preview</h2>
                 <p className="text-slate-600 dark:text-slate-400 mt-2">Manage sections, items, quantities, and pricing data.</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12">Who Quantara is For</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {["General Contracting", "MEP Contracting", "HVAC & Fit-out", "Quantity Surveying"].map((industry, i) => (
              <div key={i} className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center font-medium text-slate-800 dark:text-slate-200">
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">Core Capabilities</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold rounded-full">Live</div>
              <FileText className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">AI-Assisted Document Extraction</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Extract relevant scope, item, quantity, and specification information from supported project documents for structured human review.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold rounded-full">Live</div>
              <BoxSelect className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Structured BOQ Management</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold rounded-full">Preview UI</div>
              <FolderKanban className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Automated Item Grouping</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Group extracted or entered BOQ content into controlled categories and sections while preserving review and editing.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold rounded-full">Live</div>
              <ShieldCheck className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Project and Client Workspaces</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Manage BOQs, project information, clients, revisions, and generated project records within controlled company workspaces.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold rounded-full">Live</div>
              <LayoutTemplate className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Governed Templates and Documents</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Use approved templates to create consistent proposals, BOQ documents, and technical project outputs.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold rounded-full">In Development</div>
              <Database className="h-10 w-10 text-blue-600 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Pricing and Supplier Intelligence</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Build controlled pricing information and supplier-related workflows to support future estimating intelligence.</p>
            </div>

          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">How Quantara Works</h2>
          
          <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-4 md:ml-0 space-y-10">
            {[
              "Create a company workspace.",
              "Add a client and project.",
              "Upload or import supported project documents.",
              "Review AI-assisted extracted information.",
              "Organize BOQ sections and items.",
              "Confirm quantities, units, descriptions, and specifications.",
              "Apply approved catalogue items, templates, and pricing information where available.",
              "Review revisions and project history.",
              "Generate the supported BOQ, proposal, or technical document.",
              "Complete a professional human review before issuing the final document."
            ].map((step, index) => (
              <li key={index} className="ml-8">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-950 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-sm">
                  {index + 1}
                </span>
                <p className="text-lg text-slate-700 dark:text-slate-300 pt-1">{step}</p>
              </li>
            ))}
          </ol>

          <div className="mt-16 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-r-lg">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Professional Disclaimer</h3>
            <p className="text-amber-700 dark:text-amber-400/90 text-sm leading-relaxed">
              Quantara assists with extraction, organization, calculation workflows, and document preparation. A qualified estimator, quantity surveyor, engineer, or responsible project professional must review project scope, quantities, specifications, rates, exclusions, and final documents before commercial or contractual use.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Supported Inputs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-4 rounded-tl-lg font-semibold border-b dark:border-slate-700">Format</th>
                  <th className="p-4 font-semibold border-b dark:border-slate-700">Method</th>
                  <th className="p-4 font-semibold border-b dark:border-slate-700">Max Size</th>
                  <th className="p-4 rounded-tr-lg font-semibold border-b dark:border-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="p-4 text-slate-900 dark:text-slate-200 font-medium">PDF (Text-based)</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">Layout analysis & text extraction</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">10 MB</td>
                  <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-medium">Live</span></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-900 dark:text-slate-200 font-medium">PDF (Scanned)</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">OCR</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">20 MB</td>
                  <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-medium">Live</span></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-900 dark:text-slate-200 font-medium">XLSX / CSV</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">Structural mapping</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">5 MB</td>
                  <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-medium">Live</span></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-900 dark:text-slate-200 font-medium">CAD / BIM / IFC</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">Model geometry extraction</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">-</td>
                  <td className="p-4"><span className="px-2 py-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-md text-xs font-medium">Planned</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Supported Outputs</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {["PDF", "DOCX", "XLSX", "CSV", "Client Proposal", "Technical Report", "BOQ Document", "Revision Snapshot"].map((fmt, i) => (
              <div key={i} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center hover:border-blue-500 transition-colors">
                <FileText className="h-8 w-8 text-slate-400 mb-3" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-200">{fmt}</h3>
                <span className="mt-2 text-xs font-medium px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">Live</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Security & Data Handling</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Quantara enforces authenticated access controls. Additional security, compliance, and data-processing documentation is being finalized for the Early Access release.
          </p>
          <Link href="/security" className="text-blue-600 font-medium hover:underline inline-flex items-center">
            View Security Documentation <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="py-24 px-4 bg-blue-600">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Ready to streamline your BOQ workflows?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg text-base font-bold bg-white text-blue-700 hover:bg-slate-50 h-14 px-8 py-4 shadow-lg w-full sm:w-auto">
              Request Early Access
            </Link>
            <Link href="/contact-sales" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-blue-400 bg-transparent text-white hover:bg-blue-700 h-14 px-8 py-4 w-full sm:w-auto">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 max-w-6xl flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 dark:text-slate-400">
          <div className="mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Quantara AI. All rights reserved.
          </div>
          <div className="flex space-x-6">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            <Link href="/security" className="hover:text-slate-900 dark:hover:text-white">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
