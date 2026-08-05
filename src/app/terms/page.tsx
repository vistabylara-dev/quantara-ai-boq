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
          These temporary Terms apply to use of the Quantara public website and participation in the Quantara Controlled Early Access programme.
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300 mt-4">
          A complete Terms of Service agreement will be finalized before broader commercial use.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Product status</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Features may be incomplete, changed, limited, interrupted or removed during this stage.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Feature status may be shown as:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300 mt-3">
            <li>Live;</li>
            <li>Preview UI;</li>
            <li>In Development;</li>
            <li>Planned.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">No paid subscription</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Creating an Early Access account does not begin a paid subscription, automatic renewal or automatic billing.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Commercial plans, usage limits and payment terms will be provided separately before any paid service begins.
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
          <p className="text-slate-700 dark:text-slate-300 mb-2">Early Access output may contain:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>extraction errors;</li>
            <li>OCR errors;</li>
            <li>omissions;</li>
            <li>duplicated items;</li>
            <li>incorrect grouping;</li>
            <li>incorrect quantities;</li>
            <li>formatting problems;</li>
            <li>incomplete descriptions;</li>
            <li>misinterpreted specifications.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Supported formats</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Only formats expressly marked Live should be treated as currently supported.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            CAD, BIM, IFC, DWG, Revit, visual quantity takeoff, drawing-scale measurement and automatic floor-plan interpretation must not be assumed to be available unless explicitly confirmed as Live.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">User responsibilities</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-2">Users must:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>provide accurate account and company information;</li>
            <li>protect their credentials;</li>
            <li>use Quantara lawfully;</li>
            <li>upload only authorized content;</li>
            <li>avoid uploading malware;</li>
            <li>professionally review all outputs;</li>
            <li>respect confidentiality and intellectual property;</li>
            <li>avoid presenting unreviewed output as certified professional work.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Ownership and authority</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Users retain responsibility for information and documents they submit.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Users must hold the rights or authority necessary to upload client drawings, specifications, supplier information, prices, templates and other project records.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Availability</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Early Access availability is not guaranteed.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Quantara may suspend, limit or change access for maintenance, security, abuse prevention, technical issues, operational reasons or product changes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Prohibited use</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-2">Users must not:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>attempt unauthorized access;</li>
            <li>interfere with service operation;</li>
            <li>upload malicious code;</li>
            <li>violate privacy or intellectual-property rights;</li>
            <li>submit unlawful content;</li>
            <li>misrepresent unreviewed output;</li>
            <li>attempt to extract protected credentials or source code unlawfully.</li>
          </ul>
        </section>

        <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-4">Reliance limitation</h2>
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Do not rely exclusively on Quantara for tender submission, pricing, procurement, contractual commitments, project valuation, payment certification, construction execution or regulatory compliance. Independent professional review is required.
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
