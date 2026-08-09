import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";

export const metadata = createPublicPageMetadata("/gcc-boq-software");



const regionalLinks = [
  { href: "/boq-software-uae", name: "UAE BOQ Software", desc: "For UAE contractors, estimators and quantity surveyors." },
  { href: "/boq-software-dubai", name: "Dubai BOQ Software", desc: "For Dubai fit-out, MEP and construction teams." },
  { href: "/boq-software-abu-dhabi", name: "Abu Dhabi BOQ Software", desc: "For Abu Dhabi engineering and construction teams." },
  { href: "/construction-estimating-software-uae", name: "UAE Estimating Software", desc: "For UAE BOQ and project estimating workflows." },
  { href: "/mep-estimating-software-uae", name: "UAE MEP Estimating Software", desc: "For structured mechanical, electrical, and plumbing workflows." },
  { href: "/boq-software-saudi-arabia", name: "Saudi Arabia BOQ Software", desc: "For Saudi construction and estimating teams." },
  { href: "/boq-software-qatar", name: "Qatar BOQ Software", desc: "For Qatar contractors and project teams." },
  { href: "/boq-software-oman", name: "Oman BOQ Software", desc: "For Oman construction and estimating teams." }
];

export default function GCCIndexPage() {
  return (
    <>
      <PublicPageJsonLd
        path="/gcc-boq-software"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "GCC BOQ Software", path: "/gcc-boq-software" }]}
      />
      <div className="min-h-screen bg-white text-slate-900">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <PublicBreadcrumb items={[{ name: "Home", item: "/" }, { name: "GCC BOQ Software" }]} tone="light" />

        <header className="mb-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
            <Globe className="w-4 h-4" /> Regional Workflows
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-8 leading-tight">
            GCC BOQ Software for Regional Construction Project Workflows
          </h1>
          <div className="prose prose-lg text-slate-600 mx-auto leading-relaxed">
            <p>
              GCC markets have different contract practices and project requirements. Quantara offers a review-led BOQ workflow through Controlled Early Access, subject to current access and capability availability.
            </p>
            <p>
              For supported contractor packages, consultant documents or MEP schedules, Quantara captures information for review and organizes confirmed BOQ records. Available templates can support outputs, while country-specific contractual and regulatory requirements must be assessed independently.
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {regionalLinks.map((link, idx) => (
            <Link key={idx} href={link.href} className="group flex flex-col justify-between p-8 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm hover:shadow-md">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 group-hover:text-blue-700 mb-3 flex items-center justify-between">
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all" />
                </h2>
                <p className="text-slate-600">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <section className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Learn more about Quantara</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">About Us</Link>
            <Link href="/features" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">Explore Features</Link>
            <Link href="/contact-sales" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">Contact Sales</Link>
          </div>
        </section>

        <section className="mt-16 p-5 bg-slate-100 border border-slate-200 rounded-xl text-center max-w-4xl mx-auto">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Quantara assists with supported source capture, BOQ organization, project records, available templates, revisions and document-generation workflows. Regional project requirements, contractual obligations, measurement methods, rates, tax treatment, regulations and professional responsibilities vary. All quantities, units, descriptions, specifications, rates, assumptions, exclusions and generated outputs must be reviewed by appropriately qualified local construction professionals before tender, procurement, contractual or construction use.
          </p>
        </section>
      

      </div>
      </div>
    </>
  );
}
