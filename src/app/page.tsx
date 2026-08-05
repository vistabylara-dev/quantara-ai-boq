import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, LayoutTemplate, BoxSelect, FolderKanban, ShieldCheck, Database, FileBox, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import PublicFooter from "@/components/layout/public-footer";
import { publicFeatures } from "@/lib/config/features";

export const metadata: Metadata = {
  title: "Quantara BOQ and Construction Estimating Platform",
  description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Quantara BOQ and Construction Estimating Platform",
    description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2" aria-label="Quantara Home">
            <img src="/logo.png" alt="Quantara Logo" className="w-8 h-8 rounded-lg shadow-sm" />
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
            <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
               <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
               <img src="/workspace-preview.png" alt="Workspace Preview" className="z-10 w-full h-auto rounded-lg shadow-sm" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
            BOQ preparation becomes difficult when project information is scattered
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 leading-relaxed">
            Project scope often arrives across PDFs, spreadsheets, specifications, client files and company templates. Repeated copying, inconsistent descriptions, missing units, disconnected revisions and uncontrolled pricing references can delay review and increase the risk of issuing incomplete documents.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Disconnected project documents", "Repeated manual entry", "Inconsistent BOQ structures", "Difficult revision tracking"].map((pt, i) => (
              <div key={i} className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-800 dark:text-red-300 font-medium text-sm flex items-center justify-center text-center">
                {pt}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">The Quantara Advantage</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { t: "Faster preparation", d: "Organize supported project information into one structured BOQ workflow." },
              { t: "More consistent project data", d: "Use controlled sections, descriptions, units, templates and company resources." },
              { t: "Better revision visibility", d: "Keep project updates, BOQ revisions and generated records connected." },
              { t: "Professional outputs", d: "Prepare supported BOQ, proposal and technical-document formats for professional review." }
            ].map((b, i) => (
              <div key={i} className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{b.t}</h3>
                <p className="text-slate-600 dark:text-slate-400">{b.d}</p>
              </div>
            ))}
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
            
            {publicFeatures.slice(0, 6).map((f, i) => {
              const Icon = f.slug === "document-extraction" ? FileText :
                           f.slug === "boq-management" ? BoxSelect :
                           f.slug === "item-grouping" ? FolderKanban :
                           f.slug === "workspaces" ? ShieldCheck :
                           f.slug === "templates" ? LayoutTemplate :
                           f.slug === "pricing-intelligence" ? Database :
                           f.slug === "google-drive" ? FileBox :
                           f.slug === "cad-bim" ? BoxSelect :
                           FileSpreadsheet;

              const badgeColor = f.status === "live" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                 f.status === "preview" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                 f.status === "development" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                 "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
              const badgeText = f.status === "live" ? "Live" :
                                f.status === "preview" ? "Preview UI" :
                                f.status === "development" ? "In Development" :
                                "Planned";
                                
              return (
                <div key={i} className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                  <div className={`absolute top-6 right-6 px-3 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>{badgeText}</div>
                  <Icon className="h-10 w-10 text-blue-600 mb-6" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{f.name}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.shortDescription}</p>
                </div>
              );
            })}

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

      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">Frequently Asked Questions</h2>
          <div className="space-y-6 text-left">
            {[
              {
                q: "What is Quantara?",
                a: "Quantara is an AI-assisted BOQ and construction-estimating platform that helps project teams organize supported documents into structured BOQ workflows, controlled project records and professional outputs."
              },
              {
                q: "Who is Quantara designed for?",
                a: "Quantara is designed for contractors, estimators, quantity surveyors, MEP teams, fit-out companies, facilities-management teams, consultants and project businesses."
              },
              {
                q: "What is a BOQ?",
                a: "A Bill of Quantities is a structured document that lists project work items, descriptions, quantities, units and related information for estimating, tendering, procurement and commercial review."
              },
              {
                q: "Can Quantara process construction PDFs?",
                a: "Quantara supports verified text-based PDF workflows. Results depend on document quality, layout and available content, and all extracted information requires professional review."
              },
              {
                q: "Can Quantara process scanned PDFs?",
                a: "Scanned PDF support may use OCR. OCR can misread text, numbers, symbols or layouts, so extracted content must be checked carefully."
              },
              {
                q: "Does Quantara support XLSX and CSV BOQs?",
                a: "Quantara supports verified XLSX and CSV workflows for structured data import or mapping, subject to file structure and product limits."
              },
              {
                q: "Does Quantara support CAD, BIM or IFC?",
                a: "CAD, BIM and IFC workflows are planned. They must not be treated as currently available unless explicitly marked Live."
              },
              {
                q: "Can Quantara generate BOQ documents and proposals?",
                a: "Quantara supports verified document and export formats shown on the website. Generated outputs require professional review before commercial or contractual use."
              },
              {
                q: "Does Quantara replace a quantity surveyor or estimator?",
                a: "No. Quantara assists with extraction, organization and document preparation. Qualified professionals must review quantities, rates, specifications, assumptions, exclusions and final documents."
              },
              {
                q: "What does Controlled Early Access mean?",
                a: "Controlled Early Access means product access and feature availability may be limited while Quantara is tested, improved and prepared for broader commercial release."
              }
            ].map((faq, i) => (
              <div key={i} className="pb-6 border-b border-slate-200 dark:border-slate-800 last:border-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{faq.q}</h3>
                <p className="text-slate-600 dark:text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Quantara Product Facts</h2>
          <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm text-slate-700 dark:text-slate-300">
            <ul className="space-y-3">
              <li><strong>Product name:</strong> Quantara</li>
              <li><strong>Product category:</strong> AI-assisted BOQ and construction-estimating platform</li>
              <li><strong>Status:</strong> Controlled Early Access</li>
              <li><strong>Primary users:</strong> Contractors, estimators, quantity surveyors, MEP teams, fit-out teams, consultants and project businesses</li>
              <li><strong>Live inputs:</strong> Text-based PDF, scanned PDF, XLSX and CSV, subject to verified implementation limits</li>
              <li><strong>Planned inputs:</strong> CAD, BIM and IFC workflows</li>
              <li><strong>Human review:</strong> Required before commercial, contractual, tender or construction use</li>
              <li><strong>Operator:</strong> Vista By Lara</li>
              <li><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
              <li><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
              <li><strong>Last reviewed:</strong> August 5, 2026</li>
            </ul>
          </div>
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
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://quantara.vistabylara.com/#organization",
                "name": "Quantara",
                "url": "https://quantara.vistabylara.com/",
                "logo": "https://quantara.vistabylara.com/logo.png",
                "contactPoint": {
                  "@type": "ContactPoint",
                  "telephone": "+971507994292",
                  "contactType": "customer support",
                  "email": "solution@vistabylara.com"
                }
              },
              {
                "@type": "WebSite",
                "@id": "https://quantara.vistabylara.com/#website",
                "url": "https://quantara.vistabylara.com/",
                "name": "Quantara",
                "publisher": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/#webpage",
                "url": "https://quantara.vistabylara.com/",
                "name": "Quantara BOQ and Construction Estimating Platform",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" }
              },
              {
                "@type": "SoftwareApplication",
                "name": "Quantara",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "url": "https://quantara.vistabylara.com/",
                "description": "Quantara is an AI-assisted BOQ and construction-estimating platform that helps contractors, estimators, quantity surveyors and project teams organize supported documents into structured BOQ workflows, controlled project records and professional outputs."
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "What is Quantara?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Quantara is an AI-assisted BOQ and construction-estimating platform that helps project teams organize supported documents into structured BOQ workflows, controlled project records and professional outputs."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Who is Quantara designed for?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Quantara is designed for contractors, estimators, quantity surveyors, MEP teams, fit-out companies, facilities-management teams, consultants and project businesses."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "What is a BOQ?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "A Bill of Quantities is a structured document that lists project work items, descriptions, quantities, units and related information for estimating, tendering, procurement and commercial review."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can Quantara process construction PDFs?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Quantara supports verified text-based PDF workflows. Results depend on document quality, layout and available content, and all extracted information requires professional review."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can Quantara process scanned PDFs?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Scanned PDF support may use OCR. OCR can misread text, numbers, symbols or layouts, so extracted content must be checked carefully."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Does Quantara support XLSX and CSV BOQs?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Quantara supports verified XLSX and CSV workflows for structured data import or mapping, subject to file structure and product limits."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Does Quantara support CAD, BIM or IFC?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "CAD, BIM and IFC workflows are planned. They must not be treated as currently available unless explicitly marked Live."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can Quantara generate BOQ documents and proposals?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Quantara supports verified document and export formats shown on the website. Generated outputs require professional review before commercial or contractual use."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Does Quantara replace a quantity surveyor or estimator?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "No. Quantara assists with extraction, organization and document preparation. Qualified professionals must review quantities, rates, specifications, assumptions, exclusions and final documents."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "What does Controlled Early Access mean?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Controlled Early Access means product access and feature availability may be limited while Quantara is tested, improved and prepared for broader commercial release."
                    }
                  }
                ]
              }
            ]
          })
        }}
      />

      <PublicFooter />
    </div>
  );
}
