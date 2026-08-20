import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export const metadata = createPublicPageMetadata("/comparisons");

const searchEntry = getPublicSearchPage("/comparisons");
const pageSchema = buildPublicPageGraph({
  path: "/comparisons",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "Comparisons", path: "/comparisons" },
  ],
});

const CATEGORIES = [
  {
    title: "Software and Spreadsheet Comparisons",
    links: [
      { url: "/boq-software-comparison-uae", label: "BOQ Software Comparison UAE", desc: "Compare Quantara, CostX, Candy, Procore, Autodesk Forma Takeoff, STACK and PlanSwift using official sources and explicit eligibility boundaries." },
      { url: "/quantara-vs-excel-for-boq", label: "Quantara vs Excel for BOQ", desc: "Compare structured BOQ software with spreadsheets across project records, revisions, templates and outputs." },
      { url: "/boq-software-vs-spreadsheets", label: "BOQ Software vs Spreadsheets", desc: "When are spreadsheets sufficient, and when does structured software add value for project control?" },
      { url: "/construction-estimating-software-vs-excel", label: "Construction Estimating Software vs Excel", desc: "Compare construction estimating tools with manual Excel rate analysis and pricing formulas." }
    ]
  },
  {
    title: "Extraction and Preparation",
    links: [
      { url: "/ai-boq-vs-manual-boq-preparation", label: "AI BOQ vs Manual BOQ Preparation", desc: "Compare AI-assisted BOQ extraction with manual typing, data entry, and project organization." },
      { url: "/ocr-vs-structured-boq-extraction", label: "OCR vs Structured BOQ Extraction", desc: "Understand the difference between basic text recognition and structured field mapping and organization." }
    ]
  },
  {
    title: "Workflow Categories",
    links: [
      { url: "/quantity-takeoff-vs-boq-software", label: "Quantity Takeoff vs BOQ Software", desc: "Clarify the differences between visual drawing measurement and structured project-record management." },
      { url: "/boq-software-vs-document-management", label: "BOQ Software vs Document Management", desc: "Compare generic file storage solutions with specialized BOQ item structures and templates." },
      { url: "/when-to-use-boq-software", label: "When to Use BOQ Software", desc: "A practical decision guide on identifying when manual processes should be upgraded to structured software." }
    ]
  }
];

const PAGE_CONTENT = {
  home: "Home",
  breadcrumb: "Comparisons",
  title: "BOQ and Construction Workflow Comparisons",
  intro: "Neutral, factual comparisons to help construction professionals choose the right workflows, tools, and processes for BOQ extraction, estimating, and project control.",
  categories: CATEGORIES,
  additionalResources: "Additional Resources",
  allResources: "All Resources",
  exploreFeatures: "Explore Features",
  aboutQuantara: "About Quantara",
};

export default async function ComparisonsHubPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const content = translateStructuredContent(t, "publicRoutes.comparisonsHub", PAGE_CONTENT);
  return (
    <div className="min-h-screen bg-[#030508] text-slate-300">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
      <PublicJsonLd data={pageSchema} />
      <PublicBreadcrumb items={[{ name: content.home, item: "/" }, { name: content.breadcrumb }]} tone="dark" />

        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
            {content.title}
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            {content.intro}
          </p>
        </header>

        <div className="space-y-16">
          {content.categories.map((cat, idx) => (
            <section key={idx}>
              <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-800 pb-2">{cat.title}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cat.links.map((link, lidx) => (
                  <Link key={lidx} href={link.url} className="group block p-6 border border-slate-800 rounded-xl hover:border-blue-500 hover:bg-slate-900 transition-all bg-slate-900/50">
                    <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-blue-300 transition-colors">{link.label}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-20 border-t border-slate-800 pt-10">
          <h2 className="text-2xl font-bold text-white mb-6">{content.additionalResources}</h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/resources" className="px-5 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.allResources}</Link>
            <Link href="/features" className="px-5 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.exploreFeatures}</Link>
            <Link href="/about" className="px-5 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors">{content.aboutQuantara}</Link>
          </div>
        </section>
      
      </div>
    </div>
  );
}
