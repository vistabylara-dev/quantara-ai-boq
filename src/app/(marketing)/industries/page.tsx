import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export const metadata = createPublicPageMetadata("/industries");



const industryLinks = [
  {
    href: "/boq-software-for-contractors",
    name: "Contractors",
    desc: "Organize tender documents, subcontractor packages, and project revisions.",
    status: "Verified capabilities for standard project records."
  },
  {
    href: "/boq-software-for-quantity-surveyors",
    name: "Quantity Surveyors",
    desc: "Manage BOQ preparation, tender documentation, and rigorous revision control.",
    status: "Assists workflows; does not replace regulated QS practice."
  },
  {
    href: "/boq-software-for-mep-contractors",
    name: "MEP Contractors",
    desc: "Structure multi-discipline BOQs, coordinate specs, and manage schedules.",
    status: "No automated drawing measurement currently active."
  },
  {
    href: "/boq-software-for-hvac-contractors",
    name: "HVAC Contractors",
    desc: "Organize supported equipment, ductwork and piping records for review.",
    status: "No automated duct or pipe takeoff active."
  },
  {
    href: "/boq-software-for-fit-out-companies",
    name: "Fit-Out Companies",
    desc: "Manage detailed interior BOQs, frequent client variations, and proposals.",
    status: "No automatic room detection available."
  },
  {
    href: "/boq-software-for-fire-fighting-contractors",
    name: "Fire-Fighting Contractors",
    desc: "Organize technical BOQs, system components, and equipment schedules.",
    status: "Does not validate engineering compliance."
  },
  {
    href: "/boq-software-for-facilities-management",
    name: "Facilities Management",
    desc: "Structure BOQs for refurbishment projects and complex service packages.",
    status: "Not an asset-management or CMMS platform."
  },
  {
    href: "/boq-software-for-engineering-consultants",
    name: "Engineering Consultants",
    desc: "Manage technical schedules, document revisions, and controlled templates.",
    status: "Does not provide formal design validation."
  }
];

const PAGE_CONTENT = {
  home: "Home",
  breadcrumb: "Industries",
  title: "BOQ Software by Industry",
  intro: "Quantara supports contractors, estimators, and consultants across multiple sectors by providing structured BOQ and document workflows.",
  links: industryLinks,
};

export default async function IndustriesIndexPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const content = translateStructuredContent(t, "publicRoutes.industriesHub", PAGE_CONTENT);
  return (
    <>
      <PublicPageJsonLd
        path="/industries"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Industries", path: "/industries" }]}
      />
      <div className="min-h-screen bg-white text-slate-900">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <PublicBreadcrumb items={[{ name: content.home, item: "/" }, { name: content.breadcrumb }]} tone="light" />

        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">{content.title}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {content.intro}
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {content.links.map((link, idx) => (
            <Link key={idx} href={link.href} className="group flex flex-col justify-between p-8 bg-slate-50 border border-slate-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 transition-all">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 group-hover:text-blue-700 mb-3 flex items-center justify-between">
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all rtl:rotate-180" />
                </h2>
                <p className="text-slate-600 mb-6">{link.desc}</p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{link.status}</p>
              </div>
            </Link>
          ))}
        </div>
      

      </div>
      </div>
    </>
  );
}
