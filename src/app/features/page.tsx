import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features | Quantara Early Access",
  description: "Explore the features available in Quantara's Early Access BOQ platform, features in development, and planned capabilities.",
};

export default function FeaturesPage() {
  const liveFeatures = [
    { title: 'Multi-format BOQ extraction', desc: 'Extract scope, item, quantity, and specification information from PDF, XLSX, and CSV formats.' },
    { title: 'Automated BOQ organization and grouping', desc: 'Group extracted BOQ content into controlled categories and sections.' },
    { title: 'BOQ hierarchy and item management', desc: 'Organize BOQs into sections, items, quantities, units, and revisions.' },
    { title: 'Project and client workspaces', desc: 'Manage BOQs, projects, clients, and generated records within secure workspaces.' },
    { title: 'Document generation', desc: 'Generate professional PDFs, DOCX, XLSX, proposals, and technical reports.' },
    { title: 'Template governance', desc: 'Use approved templates to ensure consistent proposals and documents.' },
  ];

  const inDevFeatures = [
    { title: 'Supplier and supply-chain intelligence', desc: 'Integrate supplier insights for more accurate estimating workflows.' },
    { title: 'Google Drive integration', desc: 'Seamlessly import project documents and export completed BOQs to Google Drive.' },
  ];

  const plannedFeatures = [
    { title: 'CAD & BIM Extraction', desc: 'Automated extraction of quantities and specifications directly from 3D models.' },
    { title: 'Advanced Estimating Analytics', desc: 'Predictive pricing trends and risk assessment based on historical BOQ data.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 py-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
            ← Back to Home
          </Link>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Product Features</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Quantara is currently in Early Access. Below is the status of our core BOQ and estimating capabilities.
          </p>
        </div>

        <div className="space-y-16">
          <section>
            <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
              Live in Early Access
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {liveFeatures.map((f, i) => (
                <div key={i} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block animate-pulse"></span>
              In Development
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {inDevFeatures.map((f, i) => (
                <div key={i} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm opacity-80">
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
              Planned
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {plannedFeatures.map((f, i) => (
                <div key={i} className="p-6 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm opacity-70">
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-500 dark:text-slate-500 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
