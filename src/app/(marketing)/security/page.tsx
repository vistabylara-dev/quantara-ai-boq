import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";

export const metadata = createPublicPageMetadata("/security");



export default function SecurityPage() {
  return (
    <>
      <PublicPageJsonLd
        path="/security"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Security", path: "/security" }]}
      />
      <div className="max-w-3xl mx-auto py-24 px-4 min-h-[70vh]">
      <PublicBreadcrumb items={[{ name: "Home", item: "/" }, { name: "Security" }]} />
      
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Security and Controlled Early Access</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Last updated: August 5, 2026
        </p>
        <p className="text-lg text-slate-700 dark:text-slate-300">
          Quantara is currently available through Controlled Early Access.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Current security position</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p>Access to authenticated product areas requires user authentication.</p>
            <p>Quantara uses controlled company, project and user workspaces.</p>
            <p>Public marketing and legal-information pages do not require authentication.</p>
            <p>Product access and feature availability may be limited during Controlled Early Access.</p>
            <p>Security, retention and data-processing documentation is being finalized before broader commercial onboarding.</p>
            <p>Professional users remain responsible for reviewing information before commercial, contractual, tender or construction use.</p>
          </div>
        </section>

        <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl">
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-4">Important limitation</h2>
          <div className="space-y-4 text-amber-800 dark:text-amber-200">
            <p>No internet service, software platform or electronic-storage method can guarantee absolute security.</p>
            <p>Do not upload confidential drawings, restricted specifications, commercially sensitive pricing, private client information or third-party personal data until your organisation has reviewed and accepted the applicable final legal and data-processing terms.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Report a security concern</h2>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl mb-6">
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
              <li><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
              <li><strong>WhatsApp:</strong> <a href="https://wa.me/971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
            </ul>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Support and security reports can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p>When reporting an issue, include:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>the affected page or feature;</li>
              <li>a clear description;</li>
              <li>reproduction steps;</li>
              <li>the date and time observed;</li>
              <li>screenshots where appropriate.</li>
            </ul>
            <p className="font-medium text-rose-600 dark:text-rose-400 mt-4">
              Do not send passwords, private keys, access tokens or other authentication secrets.
            </p>
          </div>
        </section>
      </div>
      </div>
    </>
  );
}
