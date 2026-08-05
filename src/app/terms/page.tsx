import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import PublicFooter from "@/components/layout/public-footer";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms of Controlled Early Access",
  description: "Terms of Controlled Early Access for Quantara.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 min-h-[70vh]">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
          ← Back to Home
        </Link>
      </div>
      
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Terms of Controlled Early Access</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Last updated: August 5, 2026
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300">
          These temporary Terms apply to the Quantara public website and Controlled Early Access programme.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Product status</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p>Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.</p>
            <p>Features may be incomplete, changed, limited, interrupted or removed.</p>
            <p>Feature statuses may be:</p>
            <ul className="list-disc pl-5">
              <li>Live</li>
              <li>Preview UI</li>
              <li>In Development</li>
              <li>Planned</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">No paid subscription</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Creating an Early Access account does not begin a paid subscription, automatic renewal or automatic billing.
          </p>
        </section>

        <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-4">Professional review required</h2>
          <div className="space-y-4 text-amber-800 dark:text-amber-200 font-medium">
            <p>Quantara assists with document extraction, BOQ organization, project information, templates and supported document-generation workflows. It does not replace a qualified quantity surveyor, estimator, engineer, architect, project manager, commercial manager, procurement professional, legal adviser or responsible project professional.</p>
            <p>All extracted information, quantities, units, descriptions, specifications, rates, prices, assumptions, exclusions and generated documents must be independently reviewed before tender, procurement, commercial, contractual or construction use.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">No guarantee of accuracy</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-2">Outputs may contain:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>extraction errors;</li>
            <li>OCR errors;</li>
            <li>omissions;</li>
            <li>duplicated items;</li>
            <li>incorrect categorization;</li>
            <li>formatting issues;</li>
            <li>misread quantities;</li>
            <li>incomplete specifications.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Supported formats</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p>Only formats marked Live should be treated as supported.</p>
            <p className="font-medium text-rose-600 dark:text-rose-400">
              Do not imply CAD, BIM, IFC, DWG, Revit, visual takeoff or drawing-scale measurement unless separately verified.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">User responsibilities</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-2">Users must:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>provide accurate information;</li>
            <li>protect credentials;</li>
            <li>use the platform lawfully;</li>
            <li>upload only authorized content;</li>
            <li>avoid malware;</li>
            <li>review all outputs;</li>
            <li>respect confidentiality;</li>
            <li>respect intellectual property;</li>
            <li>avoid representing unreviewed output as certified work.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Availability</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Access may be suspended or limited for maintenance, product changes, security, abuse prevention or operational reasons.
          </p>
        </section>

        <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-4">Reliance limitation</h2>
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Do not rely exclusively on Quantara for tender submission, pricing, procurement, contractual commitments, project valuation, payment certification, construction execution or regulatory compliance.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Contact</h2>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
              <li><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
              <li><strong>WhatsApp:</strong> <a href="https://wa.me/971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
            </ul>
          </div>
        </section>
      </div>
      <PublicFooter />
    </div>
  );
}
