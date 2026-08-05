import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import PublicHeader from "@/components/layout/public-header";
import PublicFooter from "@/components/layout/public-footer";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { publicFeatures } from "@/lib/config/features";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Features & Status Matrix | Quantara AI BOQ",
  description: "Explore the complete feature status matrix for Quantara's AI-assisted BOQ platform.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/features",
  },
};

export default function FeaturesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />
      <PublicBreadcrumb 
        items={[
          { name: "Home", item: "/" },
          { name: "Platform", item: "/features" },
          { name: "Features", item: "/features" }
        ]}
      />
      
      <main className="flex-1">
        <section className="pt-16 pb-12 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
              Features and Status Matrix
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Explore the complete set of capabilities available in Quantara&apos;s Controlled Early Access. Quantara provides project-first BOQ workflows with strict governance and professional review requirements.
            </p>
          </div>
        </section>

        <section className="py-12 px-4 bg-slate-50 dark:bg-slate-900/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Project-first workspace</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Manage all BOQ tasks securely within dedicated project workspaces.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Manual uploads</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Upload text-based and scanned PDF BOQ documents directly into your project.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Structured imports</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Import structured BOQ data efficiently via XLSX and CSV formats.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Connected applications</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">Planned</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Directly sync project data from authorized external applications.</p>
              </div>
              
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Hybrid-source projects</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Combine PDF, spreadsheet, and connected data sources into one project workspace.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Source normalization</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Automatically map varied external formats into standard, reviewable items.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Project Source Centre</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Manage all ingested project documents and data versions from a central hub.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Source versions</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Maintain distinct, traceable versions of all documents uploaded to a project.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Voice instructions</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">In Development</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Provide natural spoken instructions for structuring and updating BOQs.</p>
              </div>
              
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Typed instructions</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">In Development</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Command the AI securely through text queries and typed BOQ update instructions.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Structured AI proposals</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">In Development</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Quantara proposes governed changes to your records for review, rather than modifying directly.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Selective approval</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">In Development</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Approve or reject individual proposed changes from the AI.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Governed revision creation</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Every approved change applies exclusively to a securely recorded project revision.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">BOQ source traceability</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Trace generated BOQ records directly back to the original source document.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Technical-report assistant</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">In Development</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Draft, organize and revise structured technical reports alongside the BOQ.</p>
              </div>

              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Output generation</h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Generate professional, branded PDFs and detailed XLSX spreadsheets.</p>
              </div>
              
            </div>
          </div>
        </section>
      </main>
      
      <PublicFooter />
    </div>
  );
}
