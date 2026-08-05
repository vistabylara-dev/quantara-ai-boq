import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, LayoutTemplate, BoxSelect, FolderKanban, ShieldCheck, Database, FileBox, FileSpreadsheet, CheckCircle2, XCircle, Mic2, Keyboard, GitCompareArrows, ClipboardCheck, History, AlertTriangle, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { publicFeatures } from "@/lib/config/features";

export const metadata: Metadata = {
  title: "AI BOQ Software for Dubai & UAE | Quantara",
  description: "AI BOQ software for Dubai and UAE teams. Review structured changes, approve governed revisions and create traceable outputs. Request Early Access.",
  keywords: [
    "AI BOQ software Dubai",
    "BOQ software UAE",
    "construction estimating software Dubai",
    "governed AI BOQ workflow",
    "برنامج حصر كميات بالذكاء الاصطناعي",
    "برنامج حصر كميات الإمارات"
  ],
  alternates: {
    canonical: "/",
    languages: {
      "en-AE": "/",
    },
  },
  openGraph: {
    title: "AI BOQ Software for Dubai & UAE | Quantara",
    description: "Review structured AI changes, approve governed revisions and create traceable BOQs and technical reports for Dubai and UAE projects.",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
    locale: "en_AE",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI BOQ Software for Dubai & UAE | Quantara",
    description: "Review structured AI changes, approve governed revisions and create traceable BOQs and technical reports for Dubai and UAE projects.",
  },
};

const faqs = [
  { q: "What is a Bill of Quantities (BOQ)?", a: "A Bill of Quantities is a structured document that lists project work items, descriptions, quantities, units and related information for estimating, tendering, procurement and commercial review." },
  { q: "What is BOQ software?", a: "BOQ software replaces manual spreadsheets by organizing project information, standardizing descriptions, structuring sections, and generating consistent, professional documents." },
  { q: "How do contractors prepare BOQs?", a: "Contractors extract scope from specifications and drawings, structure the items by trade or section, calculate quantities, apply approved rates, and compile the final document for submission." },
  { q: "What is the difference between an estimate and a BOQ?", a: "An estimate calculates the expected cost of a project, whereas a BOQ is a formalized, itemized list of materials, parts, and labor, often forming part of the contract." },
  { q: "What is Quantara?", a: "Quantara is an AI-assisted BOQ and construction-estimating platform that helps project teams organize supported documents into structured BOQ workflows, controlled project records and professional outputs." },
  { q: "Who is Quantara designed for?", a: "Quantara is built for general contractors, estimators, quantity surveyors, MEP contractors, interior fit-out companies, civil contractors, consultants, and developers." },
  { q: "Can Quantara process construction PDFs?", a: "Quantara supports verified text-based PDF workflows. Results depend on document quality, layout and available content, and all extracted information requires professional review." },
  { q: "Can Quantara process scanned PDFs?", a: "Scanned PDF support may use OCR. OCR can misread text, numbers, symbols or layouts, so extracted content must be checked carefully." },
  { q: "Can Quantara work with specification documents?", a: "Yes, text-based specifications can be processed to extract item descriptions and requirements, subject to the document's structure and readability." },
  { q: "Does Quantara support XLSX and CSV BOQs?", a: "Quantara supports verified XLSX and CSV workflows for structured data import or mapping, subject to file structure and product limits." },
  { q: "Does Quantara replace a quantity surveyor?", a: "No. Quantara assists with extraction, organization and document preparation. Qualified professionals must review quantities, rates, specifications, assumptions, exclusions and final documents." },
  { q: "How accurate is AI-assisted extraction?", a: "Extraction accuracy depends entirely on the clarity, formatting, and quality of the source document. The AI acts as an assistant, and human review is mandatory before utilizing the extracted data." },
  { q: "Can multiple users collaborate?", a: "Yes, Quantara supports project and client workspaces, allowing controlled, authenticated access for team members within a company." },
  { q: "Does Quantara support CAD, BIM or IFC?", a: "CAD, BIM and IFC workflows are planned. They must not be treated as currently available unless explicitly marked Live." },
  { q: "What does Controlled Early Access mean?", a: "Controlled Early Access means product access and feature availability may be limited while Quantara is tested, improved and prepared for broader commercial release." },
  { q: "Can I update a BOQ using voice instructions?", a: "Quantara is designed to accept spoken or typed instructions and convert them into structured change proposals. The user must review and approve the proposed operations before they are applied. Voice instructions do not silently alter the BOQ." },
  { q: "Can I approve only some AI changes?", a: "Where selective approval is available, users can approve individual proposed operations and reject the remaining changes. Quantara applies only the approved operations." },
  { q: "Can AI change an approved BOQ?", a: "An approved or locked BOQ should not be overwritten. Approved AI changes must create a new governed revision while preserving the previous version and its history." },
  { q: "Can the same workflow update a technical report?", a: "Yes, where implemented. Users may request additions, rewrites, observations, corrective actions, recommendations or summaries. Quantara presents the proposed report changes for approval and records the resulting revision." }
];

const governedWorkflow = [
  { title: "Create Project", desc: "Start by creating a project and entering the relevant project information. The project becomes the controlled workspace." },
  { title: "Choose Data Sources", desc: "Select the types of sources that will contribute to this project." },
  { title: "Upload, Import or Connect", desc: "Bring data in via manual upload, structured import, or an authorized connected application." },
  { title: "Normalize and Organize Source Data", desc: "Quantara normalizes the incoming data into a structured format." },
  { title: "Preview and Review", desc: "Review the source data and extracted information for accuracy." },
  { title: "Speak or Type Instructions", desc: "Where available, users can speak or type instructions.", label: "In Development" },
  { title: "AI Proposes Structured Changes", desc: "Quantara prepares structured proposed changes for review.", label: "In Development" },
  { title: "Review Assumptions, Warnings and Affected Records", desc: "Check all proposed changes, assumptions, and potential warnings." },
  { title: "Approve All, Approve Selected, Edit or Reject", desc: "The user has full control to accept or discard proposed changes." },
  { title: "Apply Only Approved Operations", desc: "Quantara applies only the operations the user approves." },
  { title: "Create or Update a Governed Revision", desc: "A formal revision is recorded preserving history." },
  { title: "Complete Professional Review", desc: "A qualified professional must review all data and decisions." },
  { title: "Generate a Traceable BOQ or Technical Report", desc: "Generate professional outputs linked directly to their sources." }
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
            AI-Assisted BOQ Software for Structured, Traceable Project Workflows
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Create one controlled project workspace, bring in supported information through uploads, structured imports or authorized connected sources, review AI-assisted proposals and generate governed BOQs and technical reports.
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
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Built for Dubai and UAE project teams</div>
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
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">Why Quantara</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Traditional Methods</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">Manual Spreadsheets:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">High risk of formula errors, inconsistent formatting across teams, and time-consuming manual entry from project documents.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">Generic OCR Tools:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Struggle with complex construction layouts, missing units, and failing to maintain the hierarchical BOQ section structure.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">Traditional Document Management:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Files remain disconnected. Pricing updates require manual cross-referencing against outdated versions.</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-8 rounded-2xl border border-blue-200 dark:border-blue-900/30 shadow-sm">
              <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-6">Quantara Workflows</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-900 dark:text-blue-100">AI-Assisted Extraction:</span>
                    <p className="text-blue-800/80 dark:text-blue-200/80 text-sm mt-1">Extract scope, item, quantity, and specification information from supported project documents for structured human review.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-900 dark:text-blue-100">Structured BOQ Management:</span>
                    <p className="text-blue-800/80 dark:text-blue-200/80 text-sm mt-1">Organize BOQs into sections, items, quantities, units, and project-specific hierarchies using controlled environments.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-900 dark:text-blue-100">Professional Document Generation:</span>
                    <p className="text-blue-800/80 dark:text-blue-200/80 text-sm mt-1">Use approved templates to create consistent proposals, BOQ documents, and technical project outputs automatically.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12">Who Should Use Quantara?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {["Contractors", "Estimators", "Quantity Surveyors", "MEP Contractors", "Interior Fit-Out Companies", "Facilities Management", "Civil Contractors", "Consultants"].map((industry, i) => (
              <div key={i} className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center font-medium text-slate-800 dark:text-slate-200 hover:border-blue-300 transition-colors cursor-default">
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

      <section id="governed-ai-instructions" aria-labelledby="governed-ai-heading" className="relative overflow-hidden py-24 px-4 bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.28),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_38%)]" aria-hidden="true"></div>
        <div className="container relative mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span role="status" className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              In Development
            </span>
            <span className="text-sm font-medium text-blue-200">Governed AI workflow</span>
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h2 id="governed-ai-heading" className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Speak or Type Instructions, Then Approve the Changes
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                After project data has been uploaded, imported or connected, users can give Quantara typed or spoken instructions. Quantara interprets the request and prepares a structured change proposal showing the affected BOQ items or report sections, assumptions, warnings and expected changes. The user reviews the proposal and decides which changes to approve before Quantara applies them and records a new revision.
              </p>

              <div className="mt-8 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-blue-200">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-6 text-blue-50">
                    AI instructions never silently alter a BOQ or technical report. Quantara applies only changes approved by the user and preserves the source instruction, proposal, approval decision and resulting revision.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-blue-200">
                      <Mic2 className="h-5 w-5" aria-hidden="true" />
                      <Keyboard className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-200">In Development</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">Voice and Typed AI Change Proposals</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Give Quantara spoken or typed instructions after bringing project data into the workspace. Quantara prepares structured, reviewable changes for the BOQ or technical report and applies only the operations you approve.
                  </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-6">
                  <GitCompareArrows className="h-6 w-6 text-blue-200" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-bold">Review before anything changes</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Proposals are designed to make affected records, before-and-after changes, assumptions, ambiguities and warnings visible before any decision is made.
                  </p>
                </article>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-blue-950/40 sm:p-6" aria-label="Concept preview of a structured AI change proposal">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">Structured change proposal</p>
                  <p className="mt-1 text-sm text-slate-400">Illustrative review flow</p>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">Not applied</span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Mic2 className="h-4 w-4" aria-hidden="true" />
                    Example instruction
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-white">“Update the description to include testing and commissioning.”</p>
                </div>

                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                    <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                    Proposed operation
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Before</p>
                      <p className="mt-2 text-sm text-slate-300">Supply and install butterfly valve.</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Proposed</p>
                      <p className="mt-2 text-sm text-emerald-50">Supply, install, test and commission butterfly valve.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Assumptions, ambiguities and warnings remain visible for review.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">User decision</p>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Available proposal decisions where implemented">
                    {['Approve All', 'Approve Selected', 'Edit Proposal', 'Reject', 'Request Reinterpretation'].map((decision) => (
                      <span key={decision} className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200">{decision}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
                  <History className="h-5 w-5 shrink-0" aria-hidden="true" />
                  Approved operations only → governed revision
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white">How to Use Quantara</h2>
          <p className="mx-auto mt-5 mb-12 max-w-2xl text-center text-slate-600 dark:text-slate-400">
            Quantara follows a project-based workflow. Users create a project, choose data sources, and bring information into the workspace through upload, import, or connected applications. Where available, users can speak or type instructions. Quantara prepares structured proposed changes for review and applies only the operations the user approves.
          </p>

          <ol className="grid gap-4 md:grid-cols-2">
            {governedWorkflow.map((step, index) => {
              return (
                <li key={step.title} className="relative rounded-2xl border p-5 pl-16 border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="absolute left-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{step.title}</h3>
                    {step.label && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {step.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.desc}</p>
                </li>
              );
            })}
          </ol>

          <aside aria-label="Professional review notice" className="mt-12 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-r-lg">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Professional Review Required</h3>
            <p className="text-amber-700 dark:text-amber-400/90 text-sm leading-relaxed">
              Uploading a drawing does not automatically confirm quantities, measurements, scope or technical accuracy. All BOQ information must be reviewed by an appropriately qualified estimator, quantity surveyor, engineer or responsible project professional before tender, procurement, contractual or construction use.
            </p>
          </aside>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-6">Practical Workflow Example</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-16 max-w-2xl mx-auto">How a Dubai or UAE MEP team can move from supported project data to an approved, professionally reviewed output.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-center justify-center text-center">
            <div className="col-span-2 md:col-span-4 lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white">Practical MEP Workflow Example</h3>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">Hypothetical workflow</span>
                </div>
                <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li>Create the MEP project workspace.</li>
                  <li>Upload consultant PDFs and import the supplier spreadsheet.</li>
                  <li>Connect an authorized external source where available.</li>
                  <li>Review source identity, revision and extracted information.</li>
                  <li>Ask Quantara to organize the equipment and valve items.</li>
                  <li>Review the structured AI proposal and its assumptions.</li>
                  <li>Approve selected changes.</li>
                  <li>Create a governed BOQ revision.</li>
                  <li>Generate PDF and XLSX outputs.</li>
                  <li>Complete professional sign-off.</li>
                </ol>
              </div>
            </div>
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
            {faqs.map((faq, i) => (
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
              <li><strong>Voice and typed AI change proposals:</strong> In Development</li>
              <li><strong>Primary users:</strong> Contractors, estimators, quantity surveyors, MEP teams, fit-out companies, facilities management, civil contractors, consultants, developers</li>
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

      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Developed and Operated by Vista By Lara</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-3xl mx-auto">
            Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows. Quantara is currently available through Controlled Early Access.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-700 dark:text-slate-300">
            <a href="https://www.vistabylara.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">www.vistabylara.com</a>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
            <a href="mailto:solution@vistabylara.com" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">solution@vistabylara.com</a>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
            <a href="tel:+971507994292" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">+971 50 799 4292</a>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-t border-blue-100 dark:border-blue-900">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">BOQ Formulas and Quantity Calculator</h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-2xl mx-auto">
            Review practical formulas for excavation, concrete, masonry, finishes, reinforcement, roofing and BOQ cost calculations, or use the free Vista By Lara BOQ Calculator.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/boq-calculation-formulas" className="inline-flex items-center justify-center rounded-lg text-base font-medium bg-blue-600 text-white hover:bg-blue-700 h-12 px-6 py-3 w-full sm:w-auto shadow-sm">
              View BOQ Formulas
            </Link>
            <a href="https://www.vistabylara.com/ai-tools/boq-calculator-uae" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg text-base font-medium border border-blue-200 bg-white text-blue-700 hover:bg-slate-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800 h-12 px-6 py-3 w-full sm:w-auto">
              Open Free BOQ Calculator
            </a>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Explore Quantara Resources</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/resources" className="block p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 transition-colors shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">BOQ Resources</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Knowledge base, definitions, and methodology guides.</p>
            </Link>
            <Link href="/industries" className="block p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 transition-colors shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Industries</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Specific workflows for contractors and trades.</p>
            </Link>
            <Link href="/gcc-boq-software" className="block p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 transition-colors shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">GCC BOQ Software</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Regional information for the UAE, Saudi Arabia, and beyond.</p>
            </Link>
            <Link href="/comparisons" className="block p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 transition-colors shadow-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Workflow Comparisons</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Compare Quantara against spreadsheets, manual processes, and OCR.</p>
            </Link>
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
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/#webpage",
                "url": "https://quantara.vistabylara.com/",
                "name": "AI BOQ Software for Dubai and UAE Project Teams",
                "inLanguage": "en-AE",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" }
              },
              {
                "@type": "SoftwareApplication",
                "@id": "https://quantara.vistabylara.com/#software",
                "name": "Quantara",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "url": "https://quantara.vistabylara.com/",
                "description": "Quantara is AI BOQ software for Dubai and UAE project teams, with controlled project data, structured review, governed revisions and professional outputs.",
                "areaServed": [
                  { "@type": "City", "name": "Dubai" },
                  { "@type": "Country", "name": "United Arab Emirates" }
                ],
                "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
                "provider": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "Service",
                "@id": "https://quantara.vistabylara.com/#governed-ai-change-proposals",
                "name": "Voice and Typed AI Change Proposals",
                "serviceType": "Governed AI-assisted BOQ and technical-report change proposals",
                "description": "In Development — Quantara is designed to prepare structured, reviewable changes from spoken or typed instructions and apply only operations approved by the user.",
                "provider": { "@id": "https://quantara.vistabylara.com/#organization" },
                "areaServed": [
                  { "@type": "City", "name": "Dubai" },
                  { "@type": "Country", "name": "United Arab Emirates" }
                ]
              },
              {
                "@type": "FAQPage",
                "mainEntity": faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.q,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.a
                  }
                }))
              }
            ]
          })
        }}
      />

      </div>
  );
}
