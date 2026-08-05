import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import PublicFooter from "./public-footer";
import PublicHeader from "@/components/layout/public-header";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";

export interface KnowledgeFaq {
  question: string;
  answer: string;
}

export interface KnowledgeLink {
  href: string;
  label: string;
  description?: string;
}

export interface KnowledgeSection {
  id: string;
  heading: string;
  level?: 2 | 3;
  paragraphs?: (string | ReactNode)[];
  bullets?: (string | ReactNode)[];
  numberedItems?: (string | ReactNode)[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  note?: string;
  checklists?: {
    groupTitle?: string;
    items: string[];
  }[];
}

export interface KnowledgePageContent {
  breadcrumbLabel: string;
  title: string;
  summary: string;
  directAnswer?: string;
  keyTakeaways?: string[];
  reviewedDate: string;
  sections: KnowledgeSection[];
  faqs: KnowledgeFaq[];
  relatedReading: KnowledgeLink[];
  schema?: Record<string, unknown>;
}

export default function KnowledgePage({ content }: { content: KnowledgePageContent }) {
  const schemaString = content.schema ? JSON.stringify(content.schema) : null;

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 font-sans">
      {schemaString && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaString }}
        />
      )}
      
      {/* Basic header placeholder that matches the public design (this assumes public header is injected or we just rely on standard navigation styles) */}
      <PublicHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-20">
        <PublicBreadcrumb items={[
          { name: "Home", item: "/" },
          { name: "Resources", item: "/resources" },
          { name: content.breadcrumbLabel }
        ]} />

        <article>
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
              {content.title}
            </h1>
            
            {content.directAnswer && (
              <div className="text-lg text-slate-800 leading-relaxed border-l-4 border-blue-600 pl-5 py-2 bg-slate-50 mb-8 rounded-r-lg">
                {content.directAnswer}
              </div>
            )}

            {content.keyTakeaways && content.keyTakeaways.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 mb-8">
                <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Key Takeaways
                </h2>
                <ul className="space-y-3">
                  {content.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-blue-500 font-bold mt-0.5 shrink-0">•</span>
                      <span className="text-slate-700 font-medium">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 md:p-8">
              <p className="text-lg text-slate-700 leading-relaxed font-medium">
                {content.summary}
              </p>
            </div>
          </header>

          <div className="prose prose-slate prose-lg max-w-none">
            {content.sections.map((section) => {
              const HeadingTag = section.level === 3 ? "h3" : "h2";
              return (
                <section key={section.id} id={section.id} className="mb-12 scroll-mt-24">
                  <HeadingTag className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">{section.heading}</HeadingTag>
                  
                  {section.paragraphs?.map((p, i) => (
                    <p key={i} className="text-slate-600 leading-relaxed mb-4">{p}</p>
                  ))}
                  
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="list-disc pl-6 mb-6 text-slate-600 space-y-2">
                      {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                  
                  {section.numberedItems && section.numberedItems.length > 0 && (
                    <ol className="list-decimal pl-6 mb-6 text-slate-600 space-y-2">
                      {section.numberedItems.map((n, i) => <li key={i}>{n}</li>)}
                    </ol>
                  )}
                  
                  {section.checklists && section.checklists.length > 0 && (
                    <div className="space-y-6 mb-6">
                      {section.checklists.map((list, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                          {list.groupTitle && <h4 className="font-semibold text-slate-900 mb-4">{list.groupTitle}</h4>}
                          <ul className="space-y-3">
                            {list.items.map((item, j) => (
                              <li key={j} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <span className="text-slate-700">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.table && (
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            {section.table.headers.map((h, i) => (
                              <th key={i} className="px-4 py-3 font-semibold text-slate-900 border-x border-slate-200">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                              {row.map((cell, j) => (
                                <td key={j} className="px-4 py-3 text-slate-600 border-x border-slate-200">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.note && (
                    <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 rounded-r-md">
                      <p className="text-blue-900 font-medium m-0">{section.note}</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <hr className="my-12 border-slate-200" />

          {/* Professional Disclaimer */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-3">Professional Disclaimer</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              This information is provided for general educational purposes and does not replace project-specific advice or professional judgment. Quantities, units, specifications, rates, assumptions, exclusions and project documents must be reviewed by an appropriately qualified construction professional before tender, procurement, contractual or construction use.
            </p>
          </section>

          {/* FAQ */}
          {content.faqs.length > 0 && (
            <section className="mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {content.faqs.map((faq, index) => (
                  <details key={index} className="group bg-white border border-slate-200 rounded-lg [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-6 text-slate-900 font-medium">
                      {faq.question}
                      <span className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-900 sm:p-3 group-open:-rotate-180 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </summary>
                    <div className="px-6 pb-6 text-slate-600">
                      <p>{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Related Reading */}
          {content.relatedReading.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Reading</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {content.relatedReading.map((link, index) => (
                  <Link key={index} href={link.href} className="group block p-6 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 mb-2 flex items-center justify-between">
                      {link.label}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </h3>
                    {link.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{link.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="bg-blue-900 rounded-2xl p-8 md:p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Improve Your BOQ Workflows</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
              Quantara helps construction teams turn supported project documents into structured BOQ records, controlled templates, revisions and professional outputs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="bg-white text-blue-900 px-8 py-3 rounded-md font-semibold hover:bg-blue-50 transition-colors">
                Request Early Access
              </Link>
              <Link href="/features" className="border border-blue-400 bg-transparent text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-800 transition-colors">
                Explore Features
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
