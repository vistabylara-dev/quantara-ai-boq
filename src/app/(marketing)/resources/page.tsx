import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export const metadata = createPublicPageMetadata("/resources");



const categories = [
  {
    title: "BOQ Fundamentals",
    links: [
      { href: "/what-is-a-boq", label: "What Is a BOQ?", desc: "A practical guide to Bills of Quantities." },
      { href: "/boq-vs-construction-estimate", label: "BOQ vs Construction Estimate", desc: "Understand the difference in scope and pricing." },
      { href: "/boq-vs-bill-of-materials", label: "BOQ vs Bill of Materials", desc: "Compare work items versus material components." },
      { href: "/how-to-prepare-a-boq", label: "How to Prepare a BOQ", desc: "Step-by-step construction workflow." }
    ]
  },
  {
    title: "BOQ Review and Control",
    links: [
      { href: "/boq-review-checklist", label: "BOQ Review Checklist", desc: "Quality-control checklist for estimators." },
      { href: "/common-boq-errors", label: "Common BOQ Errors", desc: "Errors that require professional review." },
      { href: "/boq-revision-control", label: "BOQ Revision Control", desc: "Review document versions and issue records." },
      { href: "/how-to-review-ai-extracted-boq", label: "How to Review an AI-Extracted BOQ", desc: "Source-to-output quality control workflow." }
    ]
  },
  {
    title: "PDF and OCR Workflows",
    links: [
      { href: "/how-to-convert-pdf-boq-to-excel", label: "How to Convert a PDF BOQ to Excel Safely", desc: "Structured review for converted files." },
      { href: "/text-pdf-vs-scanned-pdf", label: "Text PDF vs Scanned PDF", desc: "Why document quality matters for extraction." },
      { href: "/ocr-for-boq-documents", label: "OCR for BOQ Documents", desc: "Capabilities and limitations of text recognition." }
    ]
  },
  {
    title: "Estimating and Quantity Surveying",
    links: [
      { href: "/quantity-takeoff-vs-boq-management", label: "Quantity Takeoff vs BOQ Management", desc: "Different construction workflows." },
      { href: "/boq-management", label: "BOQ Management Software", desc: "Learn about structured project records." },
      { href: "/quantity-surveying-software", label: "Quantity Surveying Software", desc: "Review software for project control." }
    ]
  }
];

const PAGE_CONTENT = {
  home: "Home",
  breadcrumb: "Resources",
  title: "BOQ Resources & Knowledge Base",
  intro: "Educational guides and practical workflows for quantity surveyors, estimators, and commercial teams managing Bills of Quantities.",
  categories,
};

export default async function ResourcesPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const content = translateStructuredContent(t, "publicRoutes.resourcesHub", PAGE_CONTENT);
  return (
    <>
      <PublicPageJsonLd
        path="/resources"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }]}
      />
      <div className="min-h-screen bg-[#030508] text-slate-300">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <PublicBreadcrumb items={[{ name: content.home, item: "/" }, { name: content.breadcrumb }]} tone="dark" />

        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">{content.title}</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            {content.intro}
          </p>
        </header>

        <div className="space-y-16">
          {content.categories.map((category, idx) => (
            <section key={idx}>
              <h2 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">{category.title}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {category.links.map((link, j) => (
                  <Link key={j} href={link.href} className="group block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500 hover:bg-slate-900 transition-all">
                    <h3 className="font-semibold text-white group-hover:text-blue-300 mb-2 flex items-center justify-between">
                      {link.label}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all rtl:rotate-180" />
                    </h3>
                    <p className="text-sm text-slate-400">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      

      </div>
      </div>
    </>
  );
}
