import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import PublicFooter from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: "GCC BOQ Software for Construction and Estimating Teams | Quantara",
  description: "Explore how Quantara supports structured BOQ, document, revision and professional-review workflows for construction teams across the GCC.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/gcc-boq-software",
  },
  openGraph: {
    title: "GCC BOQ Software for Construction and Estimating Teams | Quantara",
    description: "Explore how Quantara supports structured BOQ, document, revision and professional-review workflows for construction teams across the GCC.",
    url: "https://quantara.vistabylara.com/gcc-boq-software",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  }
};

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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-blue-900">Quantara</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href="/features" className="text-sm font-medium text-slate-600 hover:text-blue-600">Features</Link>
            <Link href="/resources" className="text-sm font-medium text-slate-600 hover:text-blue-600">Resources</Link>
            <Link href="/industries" className="text-sm font-medium text-slate-600 hover:text-blue-600">Industries</Link>
            <Link href="/contact-sales" className="text-sm font-medium text-slate-600 hover:text-blue-600">Contact Sales</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 hidden sm:block">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              Request Early Access
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-16 md:py-24">
        <header className="mb-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
            <Globe className="w-4 h-4" /> Regional Workflows
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-8 leading-tight">
            GCC BOQ Software for Regional Construction Project Workflows
          </h1>
          <div className="prose prose-lg text-slate-600 mx-auto leading-relaxed">
            <p>
              The GCC contains diverse markets, contract practices, and project requirements. Quantara supports these document-heavy tender and revision workflows across the region.
            </p>
            <p>
              Whether handling contractor packages, consultant documentation, or MEP coordination, Quantara helps structure BOQ records from supported document formats into controlled templates. All outputs require professional review, and country-specific regulatory requirements must be assessed independently.
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
            Quantara assists with supported document extraction, BOQ organization, project records, templates, revisions and document-generation workflows. Regional project requirements, contractual obligations, measurement methods, rates, tax treatment, regulations and professional responsibilities vary. All quantities, units, descriptions, specifications, rates, assumptions, exclusions and generated outputs must be reviewed by appropriately qualified local construction professionals before tender, procurement, contractual or construction use.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
