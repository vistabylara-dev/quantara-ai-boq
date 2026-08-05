import React from "react";
import Link from "next/link";
import { Metadata } from "next";
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
          This temporary Privacy Policy explains the basic categories of information that may be collected through the Quantara public website, Early Access registration and sales-enquiry processes.
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300 mt-4">
          A complete Privacy Policy will be finalized before broader commercial onboarding or routine processing of confidential customer project information.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Information we may collect</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
            <li>full name;</li>
            <li>business email address;</li>
            <li>telephone number;</li>
            <li>company name;</li>
            <li>country;</li>
            <li>job title or professional role;</li>
            <li>company type;</li>
            <li>industry or construction discipline;</li>
            <li>intended use;</li>
            <li>approximate project or BOQ volume;</li>
            <li>requested input and output formats;</li>
            <li>preferred contact method;</li>
            <li>Early Access interest information;</li>
            <li>support, sales and security messages;</li>
            <li>browser, device, IP address and basic website-usage logs.</li>
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
            Creating an Early Access account does not begin a paid subscription, automatic renewal or automatic billing.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Access may be limited according to product readiness, supported formats, onboarding capacity and intended use.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Project documents</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Approved users may later be able to upload project documents through authenticated product areas.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Users are responsible for ensuring they have the rights and lawful authority to upload and process client drawings, specifications, BOQ files, supplier information, pricing information, templates, project records and third-party information.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Users should not upload confidential or restricted project information until their organisation has reviewed and accepted the applicable final legal and data-processing terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Service providers</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Vista By Lara may use service providers for website hosting, databases, authentication, communications, analytics, security monitoring and technical operations.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Do not name specific providers unless they have been verified and approved for publication.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Data retention</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Enquiry, registration and support information may be retained for as long as reasonably necessary to manage Early Access participation, respond to requests, maintain operational and security records and comply with applicable obligations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Data sharing</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Vista By Lara does not sell personal information submitted through the Quantara website.
            Information may be disclosed to service providers acting on our behalf, professional advisers or authorities where reasonably required for operational, security or legal purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Correction and deletion requests</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Users may request correction or deletion of submitted personal information, subject to applicable legal, security, technical and record-keeping requirements.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Security</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Quantara uses authenticated access controls for protected product areas. Additional security, retention and data-processing documentation is being finalized for Controlled Early Access.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">International processing</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Website and operational service providers may process information in countries other than the user’s country.
          </p>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            Additional information will be provided in the complete Privacy Policy and data-processing documentation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Children</h2>
          <p className="text-slate-700 dark:text-slate-300">
            Quantara is intended for business and professional users and is not directed to children.
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
      </div>
  );
}
