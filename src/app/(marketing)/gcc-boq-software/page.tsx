import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/gcc-boq-software", locale);
}



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

export default async function GCCIndexPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const content = translateStructuredContent(t, "publicRoutes.gccHub", {
    home: "Home",
    breadcrumb: "GCC BOQ Software",
    eyebrow: "Regional Workflows",
    title: "GCC BOQ Software for Regional Construction Project Workflows",
    body: "For supported contractor packages, consultant documents or MEP schedules, Quantara captures information for review and organizes confirmed BOQ records. Available templates can support outputs, while country-specific contractual and regulatory requirements must be assessed independently.",
    links: regionalLinks,
    learnMore: "Learn more about Quantara",
    about: "About Us",
    features: "Explore Features",
    contactSales: "Contact Sales",
    disclaimer: "Quantara assists with supported source capture, BOQ organization, project records, available templates, revisions and document-generation workflows. Regional project requirements, contractual obligations, measurement methods, rates, tax treatment, regulations and professional responsibilities vary. All quantities, units, descriptions, specifications, rates, assumptions, exclusions and generated outputs must be reviewed by appropriately qualified local construction professionals before tender, procurement, contractual or construction use.",
  });

  return (
    <>
      <PublicPageJsonLd
        path="/gcc-boq-software"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "GCC BOQ Software", path: "/gcc-boq-software" }]}
      />
      <div className="min-h-screen bg-[#030508] text-slate-300">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <PublicBreadcrumb items={[{ name: content.home, item: "/" }, { name: content.breadcrumb }]} tone="dark" />

        <header className="mb-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900/50 border border-slate-800 text-blue-300 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
            <Globe className="w-4 h-4" /> {content.eyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-8 leading-tight">
            {content.title}
          </h1>
          <div className="prose prose-invert prose-lg text-slate-300 mx-auto leading-relaxed">
            <p>
              {t("publicContent.regional.gccAvailability")}
            </p>
            <p>
              {content.body}
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {content.links.map((link, idx) => (
            <Link key={idx} href={link.href} className="group flex flex-col justify-between p-8 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-blue-500 hover:bg-slate-900 transition-all shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-white group-hover:text-blue-300 mb-3 flex items-center justify-between">
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all rtl:rotate-180" />
                </h2>
                <p className="text-slate-400">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <section className="bg-slate-950 border border-slate-800 p-8 rounded-2xl text-center shadow-sm">
          <h2 className="text-2xl font-bold text-white mb-6">{content.learnMore}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.about}</Link>
            <Link href="/features" className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.features}</Link>
            <Link href="/contact-sales" className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.contactSales}</Link>
          </div>
        </section>

        <section className="mt-16 p-5 bg-slate-900/50 border border-slate-800 rounded-xl text-center max-w-4xl mx-auto">
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            {content.disclaimer}
          </p>
        </section>
      

      </div>
      </div>
    </>
  );
}
