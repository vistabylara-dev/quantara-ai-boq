import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicFooter from "@/components/layout/public-footer";
import PublicHeader from "@/components/layout/public-header";

export const metadata: Metadata = {
  title: "BOQ Resources and Educational Guides | Quantara",
  description: "Explore our knowledge base on Bill of Quantities fundamentals, extraction workflows, document review, and estimating best practices.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/resources",
  }
};

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
      { href: "/boq-revision-control", label: "BOQ Revision Control", desc: "Manage document versions and approvals." },
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

export default function ResourcesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 font-sans">
      <PublicHeader />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-16 md:py-24">
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">BOQ Resources & Knowledge Base</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Educational guides and practical workflows for quantity surveyors, estimators, and commercial teams managing Bills of Quantities.
          </p>
        </header>

        <div className="space-y-16">
          {categories.map((category, idx) => (
            <section key={idx}>
              <h2 className="text-2xl font-bold text-slate-900 mb-8 border-b border-slate-200 pb-4">{category.title}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {category.links.map((link, j) => (
                  <Link key={j} href={link.href} className="group block p-6 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 mb-2 flex items-center justify-between">
                      {link.label}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm text-slate-600">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
