import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import PublicFooter from "@/components/layout/public-footer";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy",
  description: "Privacy Policy for Quantara Early Access.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 min-h-[70vh]">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
          ← Back to Home
        </Link>
      </div>
      
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Privacy Policy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Last updated: August 5, 2026
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300">
          Quantara is a Controlled Early Access BOQ and construction-estimating platform operated by Vista By Lara.
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300 mt-4">
          This temporary Privacy Policy explains the basic categories of information that may be collected through the Quantara public website and Early Access registration process. A complete Privacy Policy will be finalized before broader commercial onboarding or processing of confidential customer project information.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Information we may collect</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>name;</li>
            <li>business email;</li>
            <li>telephone;</li>
            <li>company name;</li>
            <li>country;</li>
            <li>role;</li>
            <li>industry or construction discipline;</li>
            <li>approximate project or BOQ volume;</li>
            <li>requested input and output formats;</li>
            <li>Early Access information;</li>
            <li>support messages;</li>
            <li>browser, device, IP and basic usage logs.</li>
          </ul>
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl">
            <p className="text-amber-800 dark:text-amber-200 font-medium">
              Do not submit confidential drawings, project specifications, commercial rates, customer records, third-party personal information or other restricted project documents through public contact forms.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Why information may be used</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>respond to enquiries;</li>
            <li>evaluate Early Access applications;</li>
            <li>provide product demonstrations;</li>
            <li>understand BOQ and estimating needs;</li>
            <li>provide support;</li>
            <li>improve the public website;</li>
            <li>protect the website from abuse;</li>
            <li>comply with applicable obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Early Access accounts</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Creating an Early Access account does not begin a paid subscription or automatic billing.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Project documents</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Approved users may later upload project documents through authenticated areas. Users must have the rights and authority to upload client drawings, specifications, supplier records, pricing and other project information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Service providers</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Hosting, databases, authentication, communications, analytics, monitoring and operational providers may be used.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Retention</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Enquiry and registration data may be retained as reasonably necessary for Early Access, security, support and legal purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Sharing</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Vista By Lara does not sell personal information submitted through the Quantara website. Information may be disclosed to service providers acting on our behalf, professional advisers or authorities where reasonably required for operational, security or legal purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">User requests</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Users may request correction or deletion subject to applicable obligations and technical limits.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Security</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Quantara uses authenticated access controls for protected product areas. Additional security and data-processing documentation is being finalized.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">International processing</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Service providers may process data in other countries and more detail will be included in final documentation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Children</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Quantara is intended for business and professional users and not directed to children.
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
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
            </p>
          </div>
        </section>
      </div>
      <PublicFooter />
    </div>
  );
}
